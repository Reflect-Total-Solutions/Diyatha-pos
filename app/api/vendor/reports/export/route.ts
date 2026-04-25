import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import {
  buildReportFilename,
  createExcelBuffer,
  createPdfBuffer,
  type ExportRow,
} from '@/lib/export-helpers';
import { toApiError, ValidationError } from '@/lib/errors';
import {
  fetchActivityReportData,
  parseReportQueryParams,
} from '@/lib/report-data';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminOrVendorRequestUser } from '@/lib/request-user';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { ActivityReportRow } from '@/types/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapActivityRows(rows: ActivityReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    activity_name: row.activity_name,
    local_count: row.local_count,
    foreign_count: row.foreign_count,
    total_count: row.total_count,
    local_total: row.local_total,
    foreign_total: row.foreign_total,
    total_amount: row.total_amount,
  }));
}

function parseExportParams(url: string): { format: 'xlsx' | 'pdf' } {
  const searchParams = new URL(url).searchParams;
  const format = searchParams.get('format');

  if (!format || !['xlsx', 'pdf'].includes(format)) {
    throw new ValidationError('Invalid format. Expected xlsx or pdf.');
  }

  return {
    format: format as 'xlsx' | 'pdf',
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAdminOrVendorRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `vendor:reports:export:${user.id}`,
      RATE_LIMITS.REPORT_EXPORT.attempts,
      RATE_LIMITS.REPORT_EXPORT.windowMs
    );

    if (!allowed) {
      return Response.json(
        {
          error: 'Too many export requests',
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const filters = parseReportQueryParams(request.url);
    const { format } = parseExportParams(request.url);

    const data = await fetchActivityReportData(supabase, user, filters);
    const exportRows = mapActivityRows(data);
    const title = 'Vendor Activity Report';
    const filename = buildReportFilename('vendor-activity', format);

    let buffer: ArrayBuffer;
    let contentType: string;

    if (format === 'xlsx') {
      buffer = createExcelBuffer(exportRows, title);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = await createPdfBuffer(title, exportRows);
      contentType = 'application/pdf';
    }

    return new Response(buffer, {
      status: HTTP_STATUS.OK,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    const apiError = toApiError(error);

    return Response.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
      },
      { status: apiError.statusCode }
    );
  }
}
