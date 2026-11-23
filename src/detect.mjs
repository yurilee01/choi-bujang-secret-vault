
function readEvents(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }

  return events.map(event => ({
    at: event?.at,
    method: event?.method,
    sub: event?.identity?.sub,
  }));
}

export function detect(events) {
  const records = readEvents(events);
  const users = new Map();

  for (const event of records) {
    if (
      event.method !== 'GET'
      || typeof event.sub !== 'string'
      || typeof event.at !== 'string'
    ) {
      continue;
    }

    const timestamp = Date.parse(event.at);

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    if (!users.has(event.sub)) {
      users.set(event.sub, []);
    }

    users.get(event.sub).push(timestamp);
  }

  for (const [sub, timestamps] of users) {
    timestamps.sort((a, b) => a - b);

    let left = 0;

    for (let right = 0; right < timestamps.length; right += 1) {
      while (
        timestamps[right] - timestamps[left] >= 10 * 60 * 1000
      ) {
        left += 1;
      }

      if (right - left + 1 > 120) {
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject: sub,
        };
      }
    }
  }

  return { action: 'observe' };
}
