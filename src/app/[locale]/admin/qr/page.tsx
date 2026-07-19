import { QrGeneratorClient } from '@/components/Admin/QrGeneratorClient';

export const metadata = { title: 'QR-Codes' };

/**
 * /admin/qr — QR-Code-Generator für Tourismusbüros & Partner (fn-17 Slice 4).
 *
 * Erzeugt druckfähige QR-Codes auf beliebige lasstreffen.at-Ziele in DE
 * oder EN (/en-Präfix), mit fixem utm_medium=qr + utm_campaign=tourismus
 * und frei wählbarer utm_source pro Aufsteller. Rendering komplett
 * client-seitig (qrcode-Package) — kein externer QR-Dienst, keine
 * Daten-Weitergabe.
 */
export default function AdminQrPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">QR-Codes</h1>
      <p className="text-sm text-white/50 mb-8 max-w-2xl">
        Druckfähige QR-Codes für Tourismusbüros, Gemeinden und Partner — pro
        Aufsteller eine eigene utm_source, damit die Scans in den Analytics
        einzeln auswertbar sind.
      </p>
      <QrGeneratorClient />
    </div>
  );
}
