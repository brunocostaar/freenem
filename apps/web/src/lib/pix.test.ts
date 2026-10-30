import { describe, expect, it } from 'vitest';
import { buildPixPayload, crc16, sanitizeText } from './pix';

/** CRC16-CCITT-FALSE por tabela, independente da implementação bit a bit de pix.ts. */
function crcTable(data: string): string {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n << 8;
    for (let k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1;
    return c & 0xffff;
  });
  let crc = 0xffff;
  for (const ch of new TextEncoder().encode(data)) {
    crc = ((crc << 8) & 0xffff) ^ table[((crc >> 8) ^ ch) & 0xff]!;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

describe('pix', () => {
  it('CRC16-CCITT-FALSE: vetor de verificação padrão', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('gera o payload estático esperado, com CRC válido', () => {
    const p = buildPixPayload({
      key: 'apoie@freenem.local',
      name: 'Freenem',
      city: 'Porto Alegre',
      amount: 10,
    });
    const body =
      '000201' +
      '2641' +
      '0014br.gov.bcb.pix' +
      '0119apoie@freenem.local' +
      '52040000' +
      '5303986' +
      '540510.00' +
      '5802BR' +
      '5907FREENEM' +
      '6012PORTO ALEGRE' +
      '62070503***' +
      '6304';
    expect(p.slice(0, -4)).toBe(body);
    expect(p.slice(-4)).toBe(crcTable(body));
    expect(p.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('omite o campo 54 sem valor e usa 2 casas decimais', () => {
    const base = { key: 'k@x.com', name: 'A', city: 'B' };
    expect(buildPixPayload(base)).not.toContain('5404');
    expect(buildPixPayload({ ...base, amount: 7.5 })).toContain('54047.50');
    expect(buildPixPayload({ ...base, amount: 1234.5 })).toContain('54071234.50');
  });

  it('normaliza nome e cidade (acentos, maiúsculas, limites)', () => {
    expect(sanitizeText('São Joaquim da Barra do Sul', 15)).toBe('SAO JOAQUIM DA');
    expect(sanitizeText('Associação Freenem Estudos Abertos', 25).length).toBeLessThanOrEqual(25);
    expect(buildPixPayload({ key: 'k', name: 'José', city: 'São Paulo' })).toContain(
      '5904JOSE6009SAO PAULO',
    );
  });
});
