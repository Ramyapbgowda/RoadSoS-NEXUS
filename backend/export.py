"""
RoadSoS NEXUS - Export Module
================================
Real CSV export (stdlib csv) and a simple real PDF export (no external
service — hand-rolled minimal PDF writer so no extra heavy dependency is
required; swap for `reportlab` if you want richer PDF styling).
"""
import csv
import io


def incidents_to_csv(incidents: list) -> str:
    if not incidents:
        return "incident_id,lat,lon,severity,risk_band,created_at\n"
    output = io.StringIO()
    fieldnames = list(incidents[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in incidents:
        writer.writerow(row)
    return output.getvalue()


def incidents_to_pdf_bytes(incidents: list) -> bytes:
    """
    Minimal single-page-per-batch PDF generator using raw PDF syntax —
    no reportlab/weasyprint dependency needed. Good enough for an admin
    export; swap for reportlab if you want multi-page pagination/styling.
    """
    lines = ["RoadSoS NEXUS - Incident Export", f"Total incidents: {len(incidents)}", ""]
    for inc in incidents[:40]:  # keep single-page readable
        lines.append(
            f"{inc.get('incident_id','')}  |  {inc.get('severity','')}  |  "
            f"risk={inc.get('risk_band','')}  |  {inc.get('hospital','')}  |  {inc.get('created_at','')}"
        )

    def esc(s):
        return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    content_lines = []
    y = 780
    for line in lines:
        content_lines.append(f"BT /F1 9 Tf 40 {y} Td ({esc(line)}) Tj ET")
        y -= 14
    content_stream = "\n".join(content_lines)

    objects = []
    objects.append("<< /Type /Catalog /Pages 2 0 R >>")
    objects.append("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append("<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> "
                    "/MediaBox [0 0 612 792] /Contents 5 0 R >>")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    stream_bytes = content_stream.encode("latin-1", errors="replace")
    objects.append(f"<< /Length {len(stream_bytes)} >>\nstream\n{content_stream}\nendstream")

    pdf = io.BytesIO()
    pdf.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(pdf.tell())
        pdf.write(f"{i} 0 obj\n".encode())
        pdf.write(obj.encode("latin-1", errors="replace"))
        pdf.write(b"\nendobj\n")
    xref_start = pdf.tell()
    pdf.write(f"xref\n0 {len(objects)+1}\n".encode())
    pdf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.write(f"{off:010d} 00000 n \n".encode())
    pdf.write(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF".encode())
    return pdf.getvalue()
