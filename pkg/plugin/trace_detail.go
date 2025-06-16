package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

type InitialTraceDetailRequest struct {
	Depth         int `json:"depth"`
	ChildrenLimit int `json:"childrenLimit"`
	OpenSearchRequest
}

// Trace details response structures
type SpanNode struct {
	TraceID              string `json:"traceId"`
	SpanID               string `json:"spanId"`
	Name                 string `json:"name"`
	StartTime            string `json:"startTime"`
	EndTime              string `json:"endTime"`
	ParentSpanID         string `json:"parentSpanId"`
	Level                int    `json:"level"`
	CurrentChildrenCount int    `json:"currentChildrenCount"`
	TotalChildrenCount   int    `json:"totalChildrenCount"`
}

/*
Query a single span with full details by id.
This will include the total children count.
And the child span ids limited by take.
The level is the level of the returned span.
*/
func querySpanByID(client *opensearch.Client, traceID string, spanId string, level, take int) (SpanNode, []string, error) {
	log.Printf("Querying span by id: %s, traceId: %s", spanId, traceID)
	content := strings.NewReader(fmt.Sprintf(`{
    "size": 0,
    "query": {
      "term": {
        "traceId": %q
      }
    },
    "aggs": {
      "children": {
        "filter": {
          "term": {
            "parentSpanId": %q
          }
        },
        "aggs": {
          "span_docs": {
            "top_hits": {
              "size": %d,
              "sort": [{ "startTime": { "order": "asc" } }],
              "_source": ["spanId"]
            }
          }
        }
      },
      "span": {
        "filter": {
          "term": {
            "spanId": %q
          }
        },
        "aggs": {
          "doc": {
            "top_hits": {
              "size": 1
            }
          }
        }
      }
    }
  }`, traceID, spanId, take, spanId))

	search := opensearchapi.SearchRequest{
		Index: []string{"ss4o_traces-default-namespace"},
		Body:  content,
	}

	searchResponse, err := search.Do(context.Background(), client)
	if err != nil {
		return SpanNode{}, make([]string, 0), fmt.Errorf("failed to execute OpenSearch query: %v", err)
	}
	defer searchResponse.Body.Close()

	// Define a struct to parse the aggregation
	type aggResponse struct {
		OpenSearchResponse
		Aggregations struct {
			Children struct {
				DocCount int `json:"doc_count"`
				SpanDocs struct {
					Hits struct {
						Hits []struct {
							Source struct {
								SpanID string `json:"spanId"`
							} `json:"_source"`
						} `json:"hits"`
					} `json:"hits"`
				} `json:"span_docs"`
			} `json:"children"`
			Span struct {
				Doc struct {
					Hits Hits `json:"hits"`
				} `json:"doc"`
			} `json:"span"`
		} `json:"aggregations"`
	}

	// Read and log the response body
	bodyBytes, err := io.ReadAll(searchResponse.Body)
	if err != nil {
		return SpanNode{}, make([]string, 0), fmt.Errorf("failed to read response body: %v", err)
	}
	log.Printf("OpenSearch response body: %s", string(bodyBytes))

	// Create a new reader with the body bytes since we consumed the original reader
	searchResponse.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	var osResponse aggResponse
	if err := json.NewDecoder(searchResponse.Body).Decode(&osResponse); err != nil {
		return SpanNode{}, make([]string, 0), fmt.Errorf("failed to decode OpenSearch response: %v", err)
	}

	if len(osResponse.Aggregations.Span.Doc.Hits.Hits) == 0 {
		return SpanNode{}, make([]string, 0), fmt.Errorf("span not found")
	}

	hit := osResponse.Aggregations.Span.Doc.Hits.Hits[0]
	childSpanIDs := make([]string, 0, len(osResponse.Aggregations.Children.SpanDocs.Hits.Hits))
	for _, childHit := range osResponse.Aggregations.Children.SpanDocs.Hits.Hits {
		childSpanIDs = append(childSpanIDs, childHit.Source.SpanID)
	}

	return SpanNode{
		TraceID:              hit.Source.TraceID,
		SpanID:               hit.Source.SpanID,
		Name:                 hit.Source.Name,
		StartTime:            hit.Source.StartTime,
		EndTime:              hit.Source.EndTime,
		ParentSpanID:         hit.Source.ParentSpanID,
		CurrentChildrenCount: len(childSpanIDs),
		TotalChildrenCount:   osResponse.Aggregations.Children.DocCount,
		Level:                level,
	}, childSpanIDs, nil
}

/** TODO: this might give a stackoverflow, fix when required */
func initialLoadPreOrder(
	client *opensearch.Client,
	traceId, rootSpanId string,
	childrenLimit, maxDepth int,
	currentDepth int,
) ([]SpanNode, error) {
	if currentDepth > maxDepth {
		return nil, nil
	}
	node, childSpanIDs, err := querySpanByID(client, traceId, rootSpanId, currentDepth, childrenLimit)
	if err != nil {
		return nil, err
	}
	log.Printf("Found node for: traceId: %q, spanId: %q", traceId, rootSpanId)
	result := []SpanNode{node}
	for _, childID := range childSpanIDs {
		children, err := initialLoadPreOrder(client, traceId, childID, childrenLimit, maxDepth, currentDepth+1)
		if err != nil {
			return nil, err
		}
		result = append(result, children...)
	}
	return result, nil
}

/*
Returns a flat list of spans for a trace id and span id
The root span is included in the result when the ?level = 0
*/
func (a *App) handleInitialTraceDetail(w http.ResponseWriter, req *http.Request) {
	log.Println("Processing trace details request (flat list)")

	traceID := req.PathValue("traceId")
	rootSpanID := req.PathValue("spanId")
	if traceID == "" || rootSpanID == "" {
		http.Error(w, "traceId and spanId are required", http.StatusBadRequest)
		return
	}

	var requestData InitialTraceDetailRequest
	if err := json.NewDecoder(req.Body).Decode(&requestData); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Defaults
	childrenLimit := 3
	depth := 5

	// Parse optional parameters
	if requestData.ChildrenLimit > 0 {
		childrenLimit = requestData.ChildrenLimit
	}
	if requestData.Depth > 0 {
		depth = requestData.Depth
	}

	client, err := getOpenSearchClient(requestData.Url)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	spans, err := initialLoadPreOrder(client, traceID, rootSpanID, childrenLimit, depth, 1)
	if err != nil {
		log.Printf("Failed to collect descendants with stack: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(spans); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned flat trace for traceId: %s", traceID)
}
