export type ISODateString = string;

export const getMillisecondsDifferenceNative = (startTime: ISODateString, endTime: ISODateString) => {
  const s = new Date(startTime);
  const e = new Date(endTime);

  // Validate if the Date objects are valid (e.g., if parsing failed)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    throw new Error('Invalid ISO 8601 date string provided.');
  }

  return e.getTime() - s.getTime();
};

export const calculateColourBySpanId = (spanId: string) => {
  const hash = spanId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  return `hsl(${hash % 360}, 100%, 50%)`;
};

export function mkMilisecondsFromNanoSeconds(nanoSeconds: number) {
  return nanoSeconds / 1000000;
}

export function mkUnixEpochFromNanoSeconds(nanoSeconds: number) {
  return Math.floor(nanoSeconds / Math.pow(10, 9));
}

export function mkUnixEpochFromMiliseconds(miliseconds: number) {
  return Math.floor(miliseconds / 1000);
}

export function formatUnixNanoToDateTime(nanoSeconds: number, timeZone = 'UTC'): string {
  // Convert nano seconds to milliseconds
  const milliseconds = mkMilisecondsFromNanoSeconds(nanoSeconds);

  // Create Date object from milliseconds
  const date = new Date(milliseconds);

  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    fractionalSecondDigits: 3,
    timeZoneName: 'short',
    timeZone: timeZone,
  } as Intl.DateTimeFormatOptions;

  const formattedDate = new Intl.DateTimeFormat('en-UK', options).format(date);

  return formattedDate;
}
