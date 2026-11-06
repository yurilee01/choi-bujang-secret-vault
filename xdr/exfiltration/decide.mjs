export function decide(alert) {
  const description = String(alert?.rule?.description ?? '');
  const level = Number(alert?.rule?.level ?? 0);
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const data = alert?.data ?? {};
  const bytes = Number(data.bytes ?? 0);
  const files = Number(data.files ?? 0);
  const count = Number(data.count ?? 0);
  const hasDestination = Boolean(data.dstip);
  const unfamiliar = /처음 보는|평소에 쓰지 않던|다른 주소/i.test(description);
  const archive = /압축 파일|압축 파일이|압축 파일 3개/i.test(description);
  const repeated = /반복|번입니다|연속 전송/i.test(description);
  const largeTransfer = bytes >= 80000000;

  if (hasDestination && level >= 10 && mitre.some(code => code === 'T1041' || code === 'T1048')) {
    if (unfamiliar && largeTransfer && files >= 100) {
      return { action: 'block', confidence: 0.97, reason: 'large_unfamiliar_destination_transfer' };
    }
    if (archive && unfamiliar && /수업 시간 밖|업무 시간 밖/.test(description) && bytes >= 100000000) {
      return { action: 'block', confidence: 0.95, reason: 'off_hours_archive_exfiltration' };
    }
    if (repeated && largeTransfer && count >= 8) {
      return { action: 'block', confidence: 0.94, reason: 'repeated_large_external_transfer' };
    }
    if (/평소에 쓰지 않던 포트/.test(description) && bytes >= 100000000 && files >= 50) {
      return { action: 'block', confidence: 0.93, reason: 'unusual_port_bulk_transfer' };
    }
    if (/자료실 전체/.test(description) && bytes >= 300000000 && files >= 300) {
      return { action: 'block', confidence: 0.98, reason: 'bulk_archive_exfiltration' };
    }
    if (/명령 통로/.test(description) && largeTransfer && count >= 8) {
      return { action: 'block', confidence: 0.90, reason: 'repeated_c2_channel_transfer' };
    }
    if (unfamiliar || archive || repeated || largeTransfer) {
      return { action: 'alert', confidence: 0.65, reason: 'ambiguous_exfiltration_indicator' };
    }
  }

  if (hasDestination && level >= 5 && (unfamiliar || archive || repeated || bytes >= 3000000)) {
    return { action: 'alert', confidence: 0.55, reason: 'weak_external_transfer_indicator' };
  }

  return { action: 'record', confidence: 0.1, reason: 'no_supported_exfiltration_pattern' };
}
