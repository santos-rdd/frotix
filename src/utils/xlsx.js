// Gera uma planilha Excel (.xlsx) de verdade, com várias abas, sem biblioteca nativa.
// Um .xlsx é um ZIP com alguns arquivos XML; o fflate (JavaScript puro) faz o ZIP.
import { zipSync, strToU8 } from 'fflate';

const escaparXml = (texto) =>
  String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // caracteres de controle não são aceitos no XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

// Índice da coluna -> letra (0 -> A, 26 -> AA).
function letraColuna(indice) {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

// Estilos: 0 = normal, 1 = negrito (títulos), 2 = número com 2 casas, 3 = negrito com 2 casas.
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Célula: string, número, null, ou { v, negrito, moeda }.
 * - número com `moeda: true` (ou número com casas decimais) sai com 2 casas.
 */
function celulaXml(valor, linha, coluna) {
  const ref = `${letraColuna(coluna)}${linha + 1}`;
  const obj = valor !== null && typeof valor === 'object' ? valor : { v: valor };
  const v = obj.v;
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    const decimal = obj.moeda || !Number.isInteger(v);
    const estilo = decimal ? (obj.negrito ? 3 : 2) : obj.negrito ? 1 : 0;
    return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}><v>${v}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${obj.negrito ? ' s="1"' : ''}><is><t xml:space="preserve">${escaparXml(v)}</t></is></c>`;
}

function abaXml({ linhas, larguras }) {
  const cols = (larguras || []).length
    ? `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const corpo = (linhas || [])
    .map((l, i) => `<row r="${i + 1}">${(l || []).map((c, j) => celulaXml(c, i, j)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${corpo}</sheetData></worksheet>`;
}

// Nome de aba: até 31 caracteres, sem : \ / ? * [ ]
const nomeAba = (nome, i) => (String(nome || `Aba ${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || `Aba ${i + 1}`);

/**
 * abas: [{ nome, linhas: [[célula, ...], ...], larguras?: [números] }]
 * Devolve Uint8Array com o arquivo .xlsx.
 */
export function gerarXlsx(abas) {
  const nomes = abas.map((a, i) => nomeAba(a.nome, i));
  const arquivos = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${nomes.map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(ESTILOS),
  };
  abas.forEach((aba, i) => {
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(abaXml(aba));
  });
  return zipSync(arquivos, { level: 6 });
}
