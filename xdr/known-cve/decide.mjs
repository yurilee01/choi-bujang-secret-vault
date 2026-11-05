// MITRE ATT&CK: T1190 - Exploit Public-Facing Application

const PATTERNS = [
  {
    name: 'jndi_remote_lookup',
    match: (alert) => {
      const data = alert?.data ?? {};
      const request = `${data.useragent ?? ''} ${data.url ?? ''}`;
      return /\$\{jndi:(ldap|ldaps|rmi|dns|iiop):\/\//i.test(request);
    },
    confidence: 0.99,
  },
  {
    name: 'known_vulnerability_scanner',
    match: (alert) => {
      const request = `${alert?.data?.useragent ?? ''} ${alert?.data?.url ?? ''}`;
      return /\b(nuclei|nikto|nessus|openvas)\b/i.test(request);
    },
    confidence: 0.9,
  },
];

export function decide(alert) {
  const matched = PATTERNS.find((pattern) => pattern.match(alert));

  if (matched) {
    return {
      action: 'block',
      confidence: matched.confidence,
      reason: matched.name,
    };
  }

  const description = String(alert?.rule?.description ?? '');
  const request = `${alert?.data?.useragent ?? ''} ${alert?.data?.url ?? ''}`;

  if (
    /jndi|CVE-2021-44228|취약점 점검 흔적/i.test(`${description} ${request}`)
  ) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: 'ambiguous_known_cve_indicator',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: 'no_supported_attack_pattern',
  };
}
