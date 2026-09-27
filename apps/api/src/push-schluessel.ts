// Erzeugt ein VAPID-Schlüsselpaar für Web Push (einmalig, dann als Umgebungsvariablen setzen).
// Neue Schlüssel machen alle bestehenden Abos ungültig – die App meldet die Geräte dann neu an.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:du@example.org   # Kontaktadresse für die Push-Dienste');
