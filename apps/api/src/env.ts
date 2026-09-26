// Zentrale, beim Start geprüfte Konfiguration aus Umgebungsvariablen

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET muss gesetzt und mindestens 32 Zeichen lang sein (z. B. `openssl rand -base64 48`)');
}

export const env = {
  jwtSecret,
  istProduktion: process.env.NODE_ENV === 'production',
};
