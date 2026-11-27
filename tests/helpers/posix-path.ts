// 테스트의 가짜 경로는 POSIX("/h/...")로 쓴다. 코드는 node:path 로 네이티브 경로를 만들므로
// Windows 에서는 "D:\h\..." 가 된다. 비교·조회 전에 이 함수로 POSIX 모양으로 되돌린다.
export const posix = (p: string): string => p.replace(/^[A-Za-z]:/, "").replace(/\\/g, "/");
