// Writes a small Excel file (.xlsx) without any library.
// An .xlsx file is a ZIP archive of XML files. This ZIP does not compress.

export const STYLE = { NORMAL: 0, BOLD: 1, DURATION: 2, BOLD_DURATION: 3, DATE: 4 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="[h]:mm"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const escapeXml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const columnName = (index) => String.fromCharCode(65 + index);

function cellXml(cell, rowIndex, columnIndex) {
  if (cell === null || cell === "") {
    return "";
  }
  const { value, style = STYLE.NORMAL } = typeof cell === "object" ? cell : { value: cell };
  const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
  if (typeof value === "number") {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function sheetXml(columnWidths, rows) {
  const columns = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const rowsXml = rows
    .map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Writes numbers in the ZIP format. Each field is [value, size in bytes].
function binary(fields) {
  const bytes = [];
  for (const [value, size] of fields) {
    for (let index = 0; index < size; index += 1) {
      bytes.push(Math.floor(value / 256 ** index) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function zip(files) {
  const encoder = new TextEncoder();
  const DOS_DATE_1980 = 0x21;
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const common = [[20, 2], [0, 2], [0, 2], [0, 2], [DOS_DATE_1980, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2]];
    const local = binary([[0x04034b50, 4], ...common]);
    parts.push(local, nameBytes, data);
    directory.push(
      binary([[0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]),
      nameBytes,
    );
    offset += local.length + nameBytes.length + data.length;
  }

  const directorySize = directory.reduce((total, part) => total + part.length, 0);
  const end = binary([[0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [directorySize, 4], [offset, 4], [0, 2]]);
  return new Blob([...parts, ...directory, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Builds an Excel file with one sheet.
 *
 * Args:
 *   sheetName: The name of the sheet.
 *   columnWidths: The width of each column.
 *   rows: An array of rows. Each row is an array of cells. A cell is null, a
 *     text, a number, or { value, style } with a style from `STYLE`.
 *
 * Returns:
 *   A Blob with the content of the file.
 */
export function buildXlsx(sheetName, columnWidths, rows) {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zip([
    ["[Content_Types].xml", CONTENT_TYPES_XML],
    ["_rels/.rels", ROOT_RELS_XML],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML],
    ["xl/styles.xml", STYLES_XML],
    ["xl/worksheets/sheet1.xml", sheetXml(columnWidths, rows)],
  ]);
}
