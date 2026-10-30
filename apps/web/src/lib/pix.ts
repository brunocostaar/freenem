/** Geração do BR Code estático do Pix (EMV MPM), conforme o Manual de Padrões do BCB. */

export interface PixPayloadInput {
  /** chave Pix (e-mail, telefone, CPF/CNPJ ou aleatória) */
  key: string;
  /** nome do recebedor (até 25 caracteres, maiúsculas, sem acentos) */
  name: string;
  /** cidade do recebedor (até 15 caracteres, maiúsculas, sem acentos) */
  city: string;
  /** valor em reais; omitido = o pagador digita o valor */
  amount?: number;
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Maiúsculas, sem acentos e sem caracteres fora do ASCII imprimível; corta no limite. */
export function sanitizeText(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max)
    .trim();
}

/** CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), 4 dígitos hexadecimais maiúsculos. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload({ key, name, city, amount }: PixPayloadInput): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key.trim());
  let payload = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986');
  if (amount !== undefined && amount > 0) payload += field('54', amount.toFixed(2));
  payload +=
    field('58', 'BR') +
    field('59', sanitizeText(name, 25)) +
    field('60', sanitizeText(city, 15)) +
    field('62', field('05', '***'));
  payload += '6304';
  return payload + crc16(payload);
}
