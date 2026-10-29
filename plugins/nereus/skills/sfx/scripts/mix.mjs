// ffmpeg 믹스 인자. 원본 오디오가 있으면 지키고, 영상은 재인코딩하지 않는다.
// normalize=0 — amix 기본값은 입력 수로 나눠 원본 대사를 작게 만든다.
// 숫자는 filter_complex 문자열로 들어간다 — plan 은 사람이 고칠 수 있는 파일이라 숫자가 아니면 거부한다(필터 그래프 주입 방지).
function checkTrack(t, i) {
  if (!Number.isFinite(t.delayMs) || t.delayMs < 0) throw new Error(`track ${i}: delayMs must be a number >= 0`);
  if (t.gainDb !== undefined && !Number.isFinite(t.gainDb)) throw new Error(`track ${i}: gainDb must be a number`);
}

export function buildMixArgs({ video, out, tracks, hasAudio }) {
  if (!tracks?.length) throw new Error("no tracks to mix");
  tracks.forEach(checkTrack);
  // file: 접두어와 프로토콜 화이트리스트 — "-"·"concat:"·"http:" 경로나 m3u8 내용이 다른 입력을 끌어오지 못하게 한다.
  const input = (f) => ["-protocol_whitelist", "file", "-i", `file:${f}`];
  const inputs = [...input(video), ...tracks.flatMap((t) => input(t.file))];
  const chains = tracks.map((t, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round(t.delayMs))}:all=1,volume=${t.gainDb ?? 0}dB[s${i}]`);
  const labels = [...(hasAudio ? ["[0:a]"] : []), ...tracks.map((_, i) => `[s${i}]`)];
  const amix = `${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=${hasAudio ? "first" : "longest"}[aout]`;
  return [
    "-hide_banner", "-y", ...inputs,
    "-filter_complex", [...chains, amix].join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    `file:${out}`,
  ];
}
