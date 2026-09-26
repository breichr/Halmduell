// ohne leicht verwechselbare Zeichen (0/O, 1/I/L)
const CODE_ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// größtes Vielfaches der Zeichenanzahl unter 256 – Bytes darüber verwerfen, sonst wären einige Zeichen häufiger
const BYTE_GRENZE = 256 - (256 % CODE_ZEICHEN.length);

/** Kryptografisch zufälliger, gut abtippbarer Code */
export function zufallsCode(laenge: number): string {
  let code = '';
  while (code.length < laenge) {
    for (const b of crypto.getRandomValues(new Uint8Array(laenge))) {
      if (b < BYTE_GRENZE && code.length < laenge) code += CODE_ZEICHEN[b % CODE_ZEICHEN.length];
    }
  }
  return code;
}
