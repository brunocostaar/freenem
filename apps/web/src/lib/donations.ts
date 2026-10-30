/** Configuração das doações, lida de variáveis de ambiente do web (build-time). */
const env = import.meta.env;

export interface DonationsConfig {
  pixKey: string;
  pixName: string;
  pixCity: string;
  cardUrl: string;
}

export const donations: DonationsConfig = {
  pixKey: (env.VITE_PIX_KEY ?? '').trim(),
  pixName: (env.VITE_PIX_NAME ?? '').trim() || 'FREENEM',
  pixCity: (env.VITE_PIX_CITY ?? '').trim() || 'BRASIL',
  cardUrl: (env.VITE_DONATION_CARD_URL ?? '').trim(),
};

export const hasPix = donations.pixKey !== '';
export const hasCard = donations.cardUrl !== '';
