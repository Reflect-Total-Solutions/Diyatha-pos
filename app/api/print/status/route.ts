import { HTTP_STATUS } from '@/lib/constants';
import { resolvePrinterTarget } from '@/lib/printer-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const printer = await resolvePrinterTarget();

  if (!printer) {
    return Response.json(
      {
        data: {
          online: false,
        },
      },
      { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
    );
  }

  return Response.json(
    {
      data: {
        online: true,
        ip: printer.ip,
        port: printer.port,
        response_time: printer.responseTime,
      },
    },
    { status: HTTP_STATUS.OK }
  );
}
