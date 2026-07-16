from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "pdf" / "lean_whatsapp_automation_time_cost_effort.pdf"


def register_fonts():
    pdfmetrics.registerFont(TTFont("Mangal", r"C:\Windows\Fonts\mangal.ttf"))
    pdfmetrics.registerFont(TTFont("Mangal-Bold", r"C:\Windows\Fonts\mangalb.ttf"))


def page_header(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#0F172A"))
    canvas.rect(0, height - 15 * mm, width, 15 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Mangal-Bold", 9)
    canvas.drawString(15 * mm, height - 9.5 * mm, "House Of Sandhya - Lean WhatsApp Automation Estimate")
    canvas.setFont("Mangal", 8)
    canvas.drawRightString(width - 15 * mm, height - 9.5 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#E5E7EB"))
    canvas.line(15 * mm, 16 * mm, width - 15 * mm, 16 * mm)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.setFont("Mangal", 7)
    canvas.drawString(15 * mm, 10 * mm, "Prepared on 16 July 2026. Final WhatsApp rates must be checked in Meta's live pricing calculator before launch.")
    canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#101827"))
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#16A34A"))
    canvas.rect(0, height - 58 * mm, width, 58 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Mangal-Bold", 21)
    canvas.drawString(22 * mm, height - 32 * mm, "Lean WhatsApp Automation")
    canvas.setFont("Mangal", 12)
    canvas.drawString(22 * mm, height - 43 * mm, "Requirement, technology, cost, time and effort")
    canvas.setFont("Mangal", 11)
    y = height - 82 * mm
    for line in [
        "Client: House Of Sandhya",
        "Scope: Order placed -> day 2/day 4/day 6 WhatsApp if unshipped",
        "Plus: Shipped tracking WhatsApp message",
        "Hosting target: Cloudflare Workers + D1 + Cron",
        "Development: Self-built with Codex assistance",
    ]:
        canvas.drawString(22 * mm, y, line)
        y -= 10 * mm
    canvas.setFillColor(colors.HexColor("#CBD5E1"))
    canvas.setFont("Mangal", 9)
    canvas.drawString(22 * mm, 28 * mm, "This is a lean build estimate, not a full Shopify app or dashboard project.")
    canvas.restoreState()


def para(text, style):
    return Paragraph(text, style)


def table(data, widths, font_size=8.3):
    body = ParagraphStyle(
        "table_body",
        fontName="Mangal",
        fontSize=font_size,
        leading=font_size + 2.5,
        textColor=colors.HexColor("#111827"),
        wordWrap="CJK",
    )
    head = ParagraphStyle(
        "table_head",
        fontName="Mangal-Bold",
        fontSize=font_size,
        leading=font_size + 2.8,
        textColor=colors.white,
        wordWrap="CJK",
    )
    rows = []
    for r, row in enumerate(data):
        rows.append([Paragraph(str(cell), head if r == 0 else body) for cell in row])
    t = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F8FAFC")))
    t.setStyle(TableStyle(style))
    return t


def build():
    register_fonts()
    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["BodyText"], fontName="Mangal", fontSize=9.2, leading=13, textColor=colors.HexColor("#111827"))
    h1 = ParagraphStyle("h1", parent=base, fontName="Mangal-Bold", fontSize=15, leading=19, spaceBefore=7, spaceAfter=7, textColor=colors.HexColor("#0F172A"))
    h2 = ParagraphStyle("h2", parent=base, fontName="Mangal-Bold", fontSize=11.2, leading=15, spaceBefore=5, spaceAfter=4, textColor=colors.HexColor("#166534"))
    note = ParagraphStyle("note", parent=base, backColor=colors.HexColor("#ECFDF5"), borderColor=colors.HexColor("#A7F3D0"), borderWidth=0.5, borderPadding=6)
    small = ParagraphStyle("small", parent=base, fontSize=7.7, leading=10, textColor=colors.HexColor("#4B5563"))

    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=22 * mm, bottomMargin=20 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="cover", frames=[frame], onPage=cover), PageTemplate(id="main", frames=[frame], onPage=page_header)])

    story = [NextPageTemplate("main"), PageBreak()]

    story += [
        para("1. Exact Requirement", h1),
        para("Tumhari requirement sirf automated WhatsApp order updates hai. Koi full store app, dashboard, CRM, inbox, campaign builder ya marketing automation nahi banana.", base),
        table(
            [
                ["Trigger / Time", "Condition", "Action"],
                ["Order placed", "Shopify/GoKwik order Shopify me create ho", "Order data DB me save; 2/4/6 day jobs schedule"],
                ["2 din baad", "Order shipped/fulfilled nahi hua", "WhatsApp processing update send"],
                ["4 din baad", "Order abhi bhi unshipped", "WhatsApp quality/process update send"],
                ["6 din baad", "Order abhi bhi unshipped", "WhatsApp dispatch-soon update send"],
                ["Shipped hone par", "Fulfillment/tracking available", "WhatsApp tracking ID/link send"],
            ],
            [33 * mm, 66 * mm, 70 * mm],
        ),
        Spacer(1, 5),
        para("<b>Important:</b> Ye lean automation hai. Agar future me live courier events jaise in-transit/out-for-delivery/delivered chahiye, to Shiprocket/AfterShip integration alag phase me add hoga.", note),
    ]

    story += [
        para("2. Technology Definitions", h1),
        para("Cost batane se pehle har required technology ka meaning:", base),
        table(
            [
                ["Thing", "What it is", "Why needed"],
                ["GitHub repository", "Code store karne ki jagah", "Code backup, version control, Cloudflare deployment source"],
                ["Cloudflare Worker", "Serverless backend/API", "Shopify webhook receive karega aur WhatsApp API call karega"],
                ["Cloudflare D1", "Small SQL database", "Orders, scheduled jobs, message logs store karne ke liye"],
                ["Cloudflare Cron Trigger", "Scheduled runner", "Har 30/60 minutes due jobs check karega"],
                ["Shopify Webhooks", "Shopify event notification system", "Order create, order cancel, fulfillment create events receive karne ke liye"],
                ["Shopify Admin API", "Shopify order status read API", "Message send karne se pehle latest fulfillment status check"],
                ["Meta WhatsApp Cloud API", "Official WhatsApp Business messaging API", "Customer ko approved WhatsApp template messages bhejne ke liye"],
                ["Meta message templates", "Pre-approved WhatsApp message formats", "Business-initiated order updates send karne ke liye mandatory"],
            ],
            [36 * mm, 57 * mm, 76 * mm],
        ),
    ]

    story += [
        para("3. Accounts and Requirements", h1),
        table(
            [
                ["Requirement", "Required?", "Cost", "Notes"],
                ["GitHub account", "Yes", "INR 0", "Private repo free plan enough"],
                ["Cloudflare account", "Yes", "INR 0 to INR 420/month", "Free may work; Paid Workers plan approx USD 5/month if needed"],
                ["Meta Business Manager", "Yes", "INR 0", "Business verification may be requested by Meta"],
                ["WhatsApp Business Account (WABA)", "Yes", "INR 0", "Meta Business setup me create hoga"],
                ["Dedicated WhatsApp API phone number", "Yes", "INR 0 if existing spare number; else SIM recharge approx INR 150-300/month", "Normal WhatsApp app number directly use nahi karna best"],
                ["Message template approval", "Yes", "INR 0", "Meta approve karega; templates Utility category me hone chahiye"],
                ["Meta billing/payment method", "Yes", "Usage based", "Per delivered message charge"],
                ["Domain name", "No", "INR 0", "workers.dev URL enough hai; custom domain optional"],
            ],
            [43 * mm, 22 * mm, 42 * mm, 62 * mm],
            font_size=7.9,
        ),
    ]

    story += [
        para("4. Architecture", h1),
        table(
            [
                ["Step", "What happens"],
                ["1", "Shopify order create webhook Cloudflare Worker URL ko call karega"],
                ["2", "Worker HMAC verify karega, order phone/order ID save karega"],
                ["3", "D1 me day 2, day 4, day 6 reminder jobs create honge"],
                ["4", "Cron Trigger periodically due jobs pick karega"],
                ["5", "Worker Shopify Admin API se latest fulfillment status check karega"],
                ["6", "Agar unfulfilled hai to WhatsApp Cloud API se Utility template send hoga"],
                ["7", "Fulfillment/shipped webhook aate hi tracking template send hoga"],
                ["8", "Message logs D1 me save honge: sent, skipped, failed, reason"],
            ],
            [20 * mm, 149 * mm],
        ),
        Spacer(1, 5),
        para("Lean stack: Cloudflare Workers + D1 + Cron + Shopify Webhooks + Meta WhatsApp Cloud API.", note),
    ]

    story += [
        para("5. Cost Estimate", h1),
        para("Kyuki development hum khud karenge, developer/agency cost zero rakha gaya hai. Real cost mainly Cloudflare hosting aur WhatsApp delivered messages ka hoga.", base),
        table(
            [
                ["Cost item", "Definition", "Expected cost"],
                ["Development", "Code hum yahan khud banayenge", "INR 0"],
                ["GitHub", "Code repository", "INR 0"],
                ["Cloudflare Worker + Cron", "Serverless backend + scheduler", "INR 0 initially; safe budget INR 420/month if Workers Paid needed"],
                ["Cloudflare D1 database", "Orders/jobs/logs DB", "INR 0 initially within free limits"],
                ["Domain", "Custom URL", "INR 0; optional"],
                ["Meta setup/templates", "WABA, phone, template approval", "INR 0 setup fee"],
                ["WhatsApp messages", "Meta charges delivered business messages by country/category", "Planning budget INR 0.15/message for India Utility messages; exact live Meta pricing to confirm"],
                ["Phone number", "Dedicated WhatsApp API number", "INR 0 if spare number; else INR 150-300/month SIM recharge"],
            ],
            [39 * mm, 70 * mm, 60 * mm],
            font_size=7.9,
        ),
    ]

    story += [
        para("6. Monthly Cost Scenarios", h1),
        para("Max 4 WhatsApp messages per order assumed: day 2, day 4, day 6, shipped tracking. Agar order jaldi ship ho gaya to actual messages kam honge.", base),
        table(
            [
                ["Orders/month", "Max msgs/order", "Max msgs/month", "WhatsApp @ INR 0.15/msg", "Total with free Cloudflare", "Total with paid Cloudflare"],
                ["100", "4", "400", "INR 60", "INR 60", "INR 480"],
                ["500", "4", "2,000", "INR 300", "INR 300", "INR 720"],
                ["1,000", "4", "4,000", "INR 600", "INR 600", "INR 1,020"],
                ["3,000", "4", "12,000", "INR 1,800", "INR 1,800", "INR 2,220"],
                ["5,000", "4", "20,000", "INR 3,000", "INR 3,000", "INR 3,420"],
            ],
            [27 * mm, 25 * mm, 31 * mm, 37 * mm, 36 * mm, 36 * mm],
            font_size=7.2,
        ),
        para("Practical starting budget: INR 0-420/month fixed + WhatsApp usage. For most small scale cases, total monthly bill likely under INR 1,000 unless order volume grows.", note),
    ]

    story += [
        para("7. Time and Effort", h1),
        table(
            [
                ["Phase", "Work", "Time", "Effort"],
                ["Planning", "Template text, fields, flow final", "0.5 day", "Low"],
                ["Meta setup", "WABA, phone, templates, billing", "1-3 days, may wait for approval", "Medium"],
                ["Core coding", "Webhook, D1 schema, jobs, WhatsApp sender", "2-3 days", "Medium"],
                ["Cloudflare deploy", "Wrangler/GitHub deploy, env secrets, cron", "0.5-1 day", "Low-medium"],
                ["Shopify setup", "Webhooks/API access/secrets", "0.5-1 day", "Medium"],
                ["Testing", "Test orders, skipped/shipped/cancelled cases", "1-2 days", "Medium"],
                ["Go-live", "Final templates, live webhook, monitoring", "0.5 day", "Low"],
            ],
            [31 * mm, 69 * mm, 38 * mm, 31 * mm],
        ),
        para("<b>Total realistic time:</b> 5-8 working days for lean automation, assuming Meta template approval is smooth. If Meta approval delays happen, add 2-5 days waiting time.", note),
    ]

    story += [
        para("8. Final Total", h1),
        table(
            [
                ["Category", "Amount"],
                ["One-time development cost", "INR 0, because we are building ourselves"],
                ["One-time setup cost", "INR 0, unless buying a new phone/SIM"],
                ["Monthly fixed cost, lowest", "INR 0 if Cloudflare free limits are enough"],
                ["Monthly fixed cost, safe production budget", "INR 420 Cloudflare Workers Paid + optional INR 150-300 phone recharge"],
                ["Variable message cost", "Approx INR 0.15 per delivered Utility WhatsApp message planning budget"],
                ["Cost per order max", "Approx INR 0.60/order if all 4 messages deliver"],
                ["Recommended starting budget", "Keep INR 1,000/month aside for Cloudflare + WhatsApp usage at small scale"],
            ],
            [62 * mm, 107 * mm],
        ),
    ]

    story += [
        para("9. What We Will Not Build Initially", h1),
        para("To keep cost and effort low, phase 1 will not include:", base),
        table(
            [
                ["Not included initially", "Reason"],
                ["Full Shopify embedded app UI", "Not needed for message automation"],
                ["Admin dashboard", "Can be added later; logs in D1 are enough initially"],
                ["Marketing/campaign messages", "Higher compliance/cost; current need is order Utility updates"],
                ["Live courier event tracking", "Needs Shiprocket/AfterShip integration; add later if required"],
                ["Multi-store support", "Only House Of Sandhya needed now"],
            ],
            [63 * mm, 106 * mm],
        ),
    ]

    story += [
        para("10. Sources", h1),
        para("1. Meta WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing", small),
        para("2. WhatsApp Business Platform pricing: https://whatsappbusiness.com/products/platform-pricing/", small),
        para("3. Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/", small),
        para("4. Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/", small),
        para("5. Shopify webhooks: https://shopify.dev/docs/api/webhooks/latest", small),
    ]

    doc.build(story)


if __name__ == "__main__":
    build()
