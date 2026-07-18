import { DocumentTheme } from "./themes";
import { VisualLawPanel } from "../taskpane/hooks/useDocumentDesign";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const blockLabel: Record<string, string> = {
  summary: "Essencia",
  timeline: "Linha do tempo",
  flow: "Fluxo",
  obligations: "Deveres",
  alert: "Pontos de atencao",
};

const blockColor: Record<string, string> = {
  summary: "#2563EB",
  timeline: "#7C3AED",
  flow: "#0F766E",
  obligations: "#B45309",
  alert: "#B91C1C",
};

export const buildVisualLawHtml = (panel: VisualLawPanel, theme: DocumentTheme): string => {
  const title = escapeHtml(panel.title || "Visual Law");
  const subtitle = escapeHtml(panel.subtitle || "");
  const accentColor = theme.accentColor;
  const headingColor = theme.headingColor;
  const blocks = (panel.blocks || [])
    .filter((block) => block.items?.length)
    .map((block, blockIndex) => {
      const sectionColor = blockColor[block.type] || accentColor;
      const items = block.items
        .map(
          (item) => `
            <tr>
              <td style="width:34px; padding:10px 0 8px 10px; vertical-align:top;">
                <div style="width:22px; height:22px; line-height:22px; text-align:center; background:${sectionColor}; color:#FFFFFF; font-size:10px; font-weight:700;">
                  ${block.items.indexOf(item) + 1}
                </div>
              </td>
              <td style="padding:9px 12px 9px 4px; vertical-align:top; border-bottom:1px solid #E5E7EB;">
                <div style="font-size:12px; color:${headingColor}; font-weight:700; margin-bottom:2px;">
                  ${escapeHtml(item.label)}
                </div>
                <div style="font-size:11px; line-height:1.45; color:#374151;">
                  ${escapeHtml(item.text)}
                </div>
              </td>
            </tr>
          `
        )
        .join("");

      return `
        <table style="width:100%; border-collapse:collapse; margin:12px 0; background:#FFFFFF; border:1px solid #E5E7EB;">
          <tr>
            <td style="width:46px; background:${sectionColor}; color:#FFFFFF; text-align:center; vertical-align:middle; font-size:18px; font-weight:700;">
              ${String(blockIndex + 1).padStart(2, "0")}
            </td>
            <td style="padding:10px 12px; background:#F9FAFB; border-bottom:1px solid #E5E7EB;">
              <div style="font-size:10px; color:#6B7280; font-weight:700; text-transform:uppercase;">
                ${escapeHtml(blockLabel[block.type] || block.type)}
              </div>
              <div style="font-size:15px; color:${headingColor}; font-weight:700; margin-top:2px;">
                ${escapeHtml(block.title)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="width:46px; background:#F9FAFB;"></td>
            <td>
              <table style="width:100%; border-collapse:collapse;">
                ${items}
              </table>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  return `
    <div style="font-family:Aptos, Calibri, Arial, sans-serif; color:#111827; background:#FFFFFF;">
      <table style="width:100%; border-collapse:collapse; margin:0 0 14px 0; border:1px solid #E5E7EB;">
        <tr>
          <td style="width:8px; background:${accentColor};"></td>
          <td style="padding:16px 18px 14px 18px; background:#FFFFFF;">
            <div style="font-size:10px; color:${accentColor}; font-weight:700; text-transform:uppercase;">
              Visual Law
            </div>
            <div style="font-size:24px; line-height:1.15; color:${headingColor}; font-weight:700; margin-top:4px;">
              ${title}
            </div>
            <div style="font-size:12px; line-height:1.45; color:#4B5563; margin-top:7px;">
              ${subtitle}
            </div>
          </td>
        </tr>
      </table>
      ${blocks}
      <div style="font-size:9px; color:#6B7280; margin-top:10px;">
        Quadro visual gerado para leitura rapida. Revise antes de usar como versao final do documento.
      </div>
    </div>
  `;
};
