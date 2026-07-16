from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "pdf" / "whatsapp_order_updates_cost_architecture.pdf"

FONT_REG = r"C:\Windows\Fonts\mangal.ttf"
FONT_BOLD = r"C:\Windows\Fonts\mangalb.ttf"


def register_fonts():
    pdfmetrics.registerFont(TTFont("Mangal", FONT_REG))
    pdfmetrics.registerFont(TTFont("Mangal-Bold", FONT_BOLD))


def p(text, style):
    return Paragraph(text, style)


def money(value):
    return f"INR {value:,.0f}"


def page_decor(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#111827"))
    canvas.rect(0, height - 16 * mm, width, 16 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Mangal-Bold", 9)
    canvas.drawString(16 * mm, height - 10 * mm, "House Of Sandhya - WhatsApp Order Update Automation")
    canvas.setFont("Mangal", 8)
    canvas.drawRightString(width - 16 * mm, height - 10 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#E5E7EB"))
    canvas.line(16 * mm, 16 * mm, width - 16 * mm, 16 * mm)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.setFont("Mangal", 7)
    canvas.drawString(16 * mm, 10 * mm, "Estimate prepared on 16 July 2026. Final pricing depends on Meta rate card, message category, delivery volume, and vendor choices.")
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#0F172A"))
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#10B981"))
    canvas.rect(0, height - 55 * mm, width, 55 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Mangal-Bold", 22)
    canvas.drawString(22 * mm, height - 32 * mm, "WhatsApp Order Update Automation")
    canvas.setFont("Mangal", 12)
    canvas.drawString(22 * mm, height - 42 * mm, "Architecture, Cost, Requirements, Timeline, Team and Feasibility")
    canvas.setFillColor(colors.HexColor("#E5E7EB"))
    canvas.setFont("Mangal", 11)
    y = height - 78 * mm
    lines = [
        "Client: House Of Sandhya",
        "Use case: Shopify order placed -> 2-day reminders until shipped",
        "Plus: shipment confirmation and tracking updates",
        "Approach: Custom WhatsApp Cloud API app with Shopify integration",
        "Prepared: 16 July 2026",
    ]
    for line in lines:
        canvas.drawString(22 * mm, y, line)
        y -= 10 * mm
    canvas.setFillColor(colors.HexColor("#94A3B8"))
    canvas.setFont("Mangal", 9)
    canvas.drawString(22 * mm, 28 * mm, "Note: Exact WhatsApp rates must be confirmed in Meta's live pricing calculator before production.")
    canvas.restoreState()


def make_table(data, widths, header=True, font_size=8.2):
    body_style = ParagraphStyle(
        "TableBody",
        fontName="Mangal",
        fontSize=font_size,
        leading=font_size + 2.3,
        textColor=colors.HexColor("#111827"),
        wordWrap="CJK",
    )
    head_style = ParagraphStyle(
        "TableHead",
        fontName="Mangal-Bold",
        fontSize=font_size,
        leading=font_size + 2.5,
        textColor=colors.white,
        wordWrap="CJK",
    )
    wrapped = []
    for r, row in enumerate(data):
        current = []
        for cell in row:
            style = head_style if header and r == 0 else body_style
            current.append(Paragraph(str(cell), style))
        wrapped.append(current)
    t = Table(wrapped, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Mangal"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D1D5DB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Mangal-Bold"),
        ]
    for row in range(1 if header else 0, len(data)):
        if row % 2 == 0:
            style.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F9FAFB")))
    t.setStyle(TableStyle(style))
    return t


def build():
    register_fonts()
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "Base",
        parent=styles["BodyText"],
        fontName="Mangal",
        fontSize=9.2,
        leading=13,
        textColor=colors.HexColor("#111827"),
        spaceAfter=5,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=base,
        fontName="Mangal-Bold",
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=8,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=base,
        fontName="Mangal-Bold",
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#065F46"),
        spaceBefore=7,
        spaceAfter=5,
    )
    small = ParagraphStyle("Small", parent=base, fontSize=7.8, leading=10, textColor=colors.HexColor("#4B5563"))
    bullet = ParagraphStyle("Bullet", parent=base, leftIndent=10, firstLineIndent=-6, bulletIndent=0)
    note = ParagraphStyle(
        "Note",
        parent=base,
        backColor=colors.HexColor("#ECFDF5"),
        borderColor=colors.HexColor("#A7F3D0"),
        borderWidth=0.5,
        borderPadding=6,
        leading=13,
    )

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="WhatsApp Order Update Automation Estimate",
        author="Codex",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[frame], onPage=cover_page),
            PageTemplate(id="main", frames=[frame], onPage=page_decor),
        ]
    )

    story = [NextPageTemplate("main"), PageBreak()]

    story += [
        p("1. Executive Summary", h1),
        p(
            "Project feasible hai. Custom WhatsApp app ban sakta hai jo Shopify/GoKwik order create hone ke baad customer ko automated WhatsApp order-status updates bheje. "
            "SMS Alert jaisi monthly app dependency kam hogi, lekin Meta WhatsApp Business Platform ka per-delivered-message charge fir bhi lagega.",
            base,
        ),
        p(
            "<b>Recommended route:</b> Pehle MVP build karo: order created webhook, 2/4/6 day unfulfilled reminders, shipped/tracking message, logs, retries. "
            "Courier live tracking ke liye phase 2 me Shiprocket/AfterShip webhook add karo.",
            note,
        ),
    ]

    summary_data = [
        ["Item", "MVP Estimate", "Production Estimate"],
        ["Build timeline", "7-12 working days", "3-5 weeks"],
        ["One-time development", money(60000) + " - " + money(120000), money(150000) + " - " + money(350000)],
        ["Monthly hosting/tools", money(800) + " - " + money(3000), money(3000) + " - " + money(12000)],
        ["Meta WhatsApp messages", "Approx INR 0.10 - 0.25 per delivered Utility message, final rate live Meta calculator se confirm", "Same; volume tiers may reduce rate"],
        ["Feasibility", "High", "High, if Meta templates + phone setup approved"],
    ]
    story += [make_table(summary_data, [42 * mm, 62 * mm, 62 * mm]), Spacer(1, 6)]

    story += [
        p("2. User Flow", h1),
        p("Target automation:", base),
        p("- Shopify/GoKwik order placed -> app receives webhook.", bullet),
        p("- App schedules reminder jobs at day 2, day 4, and day 6.", bullet),
        p("- Each reminder se pehle app Shopify se latest fulfillment status check karega.", bullet),
        p("- Agar order unfulfilled hai, WhatsApp Utility template message send hoga.", bullet),
        p("- Jab order shipped/fulfilled ho, tracking ID/link wala WhatsApp message send hoga.", bullet),
        p("- Agar courier live events chahiye, Shiprocket/AfterShip webhook se in-transit, out-for-delivery, delivered updates send honge.", bullet),
    ]

    story += [
        p("3. Technology Stack", h1),
        make_table(
            [
                ["Layer", "Technology", "Why"],
                ["Backend API", "Node.js + Express/NestJS", "Shopify webhooks, Meta API calls, easy deployment"],
                ["Database", "PostgreSQL via Supabase/Neon/Railway", "Orders, scheduled jobs, logs, delivery status"],
                ["Queue/Scheduler", "BullMQ + Redis or cloud cron", "2-day/4-day/6-day delayed jobs reliably run karne ke liye"],
                ["Shopify integration", "Shopify Admin API + webhooks", "orders/create, fulfillments/create, cancellations, order status checks"],
                ["WhatsApp", "Meta WhatsApp Cloud API", "Direct API, BSP monthly plan ki zarurat nahi"],
                ["Hosting", "Render/Railway/Fly.io/VPS", "Low-cost Node hosting with HTTPS"],
                ["Monitoring", "Sentry + uptime monitor", "Failures, retries, webhook issues catch karne ke liye"],
                ["Optional courier", "Shiprocket/AfterShip API/webhooks", "Live shipment tracking updates"],
            ],
            [32 * mm, 48 * mm, 86 * mm],
        ),
    ]

    story += [
        p("4. Requirements and Approvals", h1),
        make_table(
            [
                ["Requirement", "Needed?", "Notes"],
                ["Meta Business Manager", "Yes", "Business portfolio ke naam se setup"],
                ["WhatsApp Business Account (WABA)", "Yes", "Meta Business settings me create hoga"],
                ["Dedicated phone number", "Yes", "Cloud API me register; existing WhatsApp app number usually direct use nahi hota unless migrated"],
                ["Display name approval", "Yes", "Example: House Of Sandhya"],
                ["Message template approval", "Yes", "Order updates Utility category me submit honge"],
                ["Billing/payment method", "Yes", "Meta per delivered message charge karega"],
                ["Customer consent", "Recommended/required by policy", "Checkout/privacy policy me WhatsApp order updates consent mention karna"],
                ["SMS DLT", "No", "WhatsApp ke liye SMS DLT/header required nahi"],
                ["Separate WhatsApp license", "No", "Platform access free; usage charges apply"],
            ],
            [52 * mm, 25 * mm, 89 * mm],
        ),
    ]

    story += [
        p("5. Message Templates", h1),
        p("Templates Meta me approve karwani hongi. Proposed category: Utility.", base),
        make_table(
            [
                ["Template name", "Message"],
                ["order_processing_update", "Hi {{1}}, your order {{2}} is currently being prepared and processed. We will notify you once it is shipped. - House Of Sandhya"],
                ["order_quality_check", "Update: Your order {{1}} is in process and quality check. Thanks for your patience. - House Of Sandhya"],
                ["order_ready_dispatch", "Your order {{1}} is almost ready for dispatch. We will share tracking details as soon as it ships. - House Of Sandhya"],
                ["order_shipped_tracking", "Good news! Your order {{1}} has been shipped. Tracking ID: {{2}}. Track here: {{3}} - House Of Sandhya"],
            ],
            [42 * mm, 124 * mm],
        ),
    ]

    story += [
        p("6. Cost Calculation", h1),
        p(
            "Meta official pricing page ke hisaab se WhatsApp Business Platform par charge delivered message par lagta hai, sent message par nahi. "
            "Rate recipient market aur message category ke hisaab se vary karta hai. For this project, messages Utility category me aane chahiye.",
            base,
        ),
        make_table(
            [
                ["Monthly orders", "Messages/order", "Delivered msgs/month", "Meta cost @ INR 0.12", "Meta cost @ INR 0.25"],
                ["500", "4", "2,000", "INR 240", "INR 500"],
                ["1,000", "4", "4,000", "INR 480", "INR 1,000"],
                ["3,000", "4", "12,000", "INR 1,440", "INR 3,000"],
                ["10,000", "4", "40,000", "INR 4,800", "INR 10,000"],
            ],
            [31 * mm, 29 * mm, 38 * mm, 34 * mm, 34 * mm],
        ),
        p(
            "Note: INR 0.12 - 0.25 per Utility message is a planning range for India. Final rate Meta pricing calculator/rate card se confirm hoga, and may change by date, volume tier, and category.",
            small,
        ),
    ]

    story += [
        p("7. One-time and Monthly Budget", h1),
        make_table(
            [
                ["Cost head", "MVP", "Production grade"],
                ["Planning + Meta setup guidance", money(10000) + " - " + money(20000), money(20000) + " - " + money(40000)],
                ["Backend + Shopify webhooks", money(25000) + " - " + money(45000), money(60000) + " - " + money(120000)],
                ["WhatsApp API integration", money(15000) + " - " + money(30000), money(40000) + " - " + money(80000)],
                ["Scheduler + retries + logs", money(15000) + " - " + money(25000), money(40000) + " - " + money(80000)],
                ["Admin dashboard", "Basic logs included", money(30000) + " - " + money(70000)],
                ["Courier tracking integration", "Not included or basic Shopify fulfillment only", money(30000) + " - " + money(80000)],
                ["QA/testing/deployment", money(10000) + " - " + money(20000), money(30000) + " - " + money(60000)],
                ["Total one-time", money(60000) + " - " + money(120000), money(150000) + " - " + money(350000)],
            ],
            [58 * mm, 54 * mm, 54 * mm],
        ),
        Spacer(1, 6),
        make_table(
            [
                ["Monthly cost head", "Expected amount"],
                ["Server hosting", money(500) + " - " + money(3000) + " for MVP"],
                ["Database/Redis", "Free - " + money(1500) + " initially"],
                ["Monitoring/logging", "Free - " + money(1000)],
                ["Meta WhatsApp usage", "Depends on delivered messages; example 4,000 utility msgs/month = approx INR 480 - INR 1,000 planning range"],
                ["Maintenance", money(5000) + " - " + money(25000) + " / month depending on support SLA"],
            ],
            [58 * mm, 108 * mm],
        ),
    ]

    story += [
        p("8. Team and Specializations Needed", h1),
        make_table(
            [
                ["Role", "Need", "Effort"],
                ["Backend developer", "Required", "Main implementation: APIs, webhooks, queue, database"],
                ["Shopify developer", "Required/part-time", "Shopify app credentials, webhooks, Admin API scopes"],
                ["Meta/WhatsApp setup person", "Required/part-time", "Business Manager, WABA, phone, templates, billing"],
                ["QA tester", "Required/part-time", "Test orders, failed cases, duplicate sends, cancellation/fulfillment scenarios"],
                ["DevOps/hosting", "Can be backend dev", "Deploy, environment variables, SSL, monitoring"],
                ["Support person", "Optional", "Daily logs and failed-message checks"],
            ],
            [45 * mm, 36 * mm, 85 * mm],
        ),
    ]

    story += [
        p("9. Timeline and Effort", h1),
        make_table(
            [
                ["Phase", "Duration", "Output"],
                ["Discovery + exact flow finalization", "0.5 - 1 day", "Message schedule, templates, data fields, opt-in wording"],
                ["Meta account/WABA/phone setup", "1 - 3 days", "Can run parallel; approval delays possible"],
                ["Template submission/approval", "1 - 5 days", "Depends on Meta review"],
                ["Backend MVP build", "4 - 7 days", "Webhook receiver, DB, scheduler, WhatsApp send"],
                ["Testing with Shopify test orders", "1 - 2 days", "Logs, retries, duplicate prevention"],
                ["Deployment + go-live", "0.5 - 1 day", "Production app live"],
                ["Courier live tracking phase", "3 - 7 days extra", "Shiprocket/AfterShip webhooks and messages"],
            ],
            [52 * mm, 34 * mm, 80 * mm],
        ),
        p("<b>Total MVP:</b> 7-12 working days if Meta setup is smooth. <b>Production-grade:</b> 3-5 weeks.", note),
    ]

    story += [
        p("10. Risks and Controls", h1),
        make_table(
            [
                ["Risk", "Impact", "Control"],
                ["Template rejected", "Messages cannot send", "Keep messages non-promotional; Utility category; clear order context"],
                ["Duplicate messages", "Bad customer experience", "Idempotency key per order + template + scheduled day"],
                ["Order shipped before scheduled WhatsApp", "Wrong message", "Always re-check Shopify fulfillment status before sending"],
                ["Phone number missing/invalid", "Message fails", "Validate E.164 phone format; fallback logs"],
                ["Meta rate/category changes", "Cost changes", "Monthly review of Meta pricing"],
                ["Courier data missing", "No tracking updates", "Phase 2 integration with Shiprocket/AfterShip"],
            ],
            [48 * mm, 42 * mm, 76 * mm],
        ),
    ]

    story += [
        p("11. Final Recommendation", h1),
        p(
            "Setup possible hai and technically straightforward hai. Sabse practical plan: first MVP direct Meta WhatsApp Cloud API se banao, "
            "SMS Alert dependency remove karo, and sirf Utility order updates send karo. Marketing/promotional WhatsApp messages ko alag rakho, "
            "kyunki marketing category ka cost zyada hota hai aur approval stricter ho sakta hai.",
            base,
        ),
        p(
            "Decision point: agar immediate low-effort launch chahiye to WATI/Interakt/AiSensy jaisa BSP fast hoga but monthly plan lagega. "
            "Agar long-term control and lower platform cost chahiye, custom Cloud API app better hai.",
            note,
        ),
    ]

    story += [
        p("12. References", h1),
        p("1. WhatsApp Business Platform Pricing: https://whatsappbusiness.com/products/platform-pricing/", small),
        p("2. Meta WhatsApp Cloud API get started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/", small),
        p("3. Meta WhatsApp message templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/", small),
        p("4. Shopify webhooks: https://shopify.dev/docs/api/webhooks/latest", small),
    ]

    doc.build(story)


if __name__ == "__main__":
    build()
