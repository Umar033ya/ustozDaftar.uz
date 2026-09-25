import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * Trigger file download in browser
 */
function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Apply borders to all cells in a range
 */
function applyTableBorders(sheet, startRow, endRow, startCol, endCol) {
  const borderStyle = {
    top: { style: "thin", color: { argb: "9CA3AF" } },
    left: { style: "thin", color: { argb: "9CA3AF" } },
    bottom: { style: "thin", color: { argb: "9CA3AF" } },
    right: { style: "thin", color: { argb: "9CA3AF" } },
  };

  for (let r = startRow; r <= endRow; r++) {
    const row = sheet.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
    }
  }
}

/**
 * Inject OpenXML native chart into Excel zip package
 */
async function attachNativeChartsToZip(excelBuffer, sheetName, numStudents, numTasks, isBSB) {
  try {
    const zip = await JSZip.loadAsync(excelBuffer);

    // Update ContentTypes
    let contentTypesXml = await zip.file("[Content_Types].xml").async("string");
    if (!contentTypesXml.includes("drawing1.xml")) {
      contentTypesXml = contentTypesXml.replace(
        "</Types>",
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.drawing+xml"/>` +
        `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
        (isBSB ? `<Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` : "") +
        "</Types>"
      );
      zip.file("[Content_Types].xml", contentTypesXml);
    }

    // Update sheet1.xml
    let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml").async("string");
    if (!sheet1Xml.includes("<drawing")) {
      sheet1Xml = sheet1Xml.replace("</worksheet>", '<drawing r:id="rIdDrawing1"/></worksheet>');
      zip.file("xl/worksheets/sheet1.xml", sheet1Xml);
    }

    // Update sheet1.xml.rels
    const sheetRelsPath = "xl/worksheets/_rels/sheet1.xml.rels";
    let sheetRelsXml = zip.file(sheetRelsPath)
      ? await zip.file(sheetRelsPath).async("string")
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

    if (!sheetRelsXml.includes("rIdDrawing1")) {
      sheetRelsXml = sheetRelsXml.replace(
        "</Relationships>",
        `<Relationship Id="rIdDrawing1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>` +
        "</Relationships>"
      );
      zip.file(sheetRelsPath, sheetRelsXml);
    }

    // Table rows math
    const studentStartRow = 7;
    const studentEndRow = 6 + numStudents;
    const pctColLetter = isBSB ? String.fromCharCode(67 + numTasks + 1) : "D"; // 'G' for 3 tasks, 'D' for ChSB

    // drawing1.xml placement
    const chart1TopRow = studentEndRow + 3;
    const chart1BottomRow = chart1TopRow + 16;
    const chart2TopRow = chart1BottomRow + 2;
    const chart2BottomRow = chart2TopRow + 16;

    let drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart1TopRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart1BottomRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Student Chart"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart1"/>
        </a:graphicData>
      </xdr:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;

    if (isBSB) {
      drawingXml += `
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart2TopRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart2BottomRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="3" name="Task Chart"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart2"/>
        </a:graphicData>
      </xdr:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
    }

    drawingXml += `\n</xdr:wsDr>`;
    zip.file("xl/drawings/drawing1.xml", drawingXml);

    let drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdChart1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>`;
    if (isBSB) {
      drawingRelsXml += `<Relationship Id="rIdChart2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>`;
    }
    drawingRelsXml += `</Relationships>`;
    zip.file("xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);

    // Chart 1: Student Percentage Chart
    const chart1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>O'quvchilar o'zlashtirish ko'rsatkichi (%)</a:t></a:r></a:p></c:rich></c:tx>
      <c:layout/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="standard"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>'${sheetName}'!$${pctColLetter}$5</c:f></c:strRef></c:tx>
          <c:cat><c:strRef><c:f>'${sheetName}'!$B$${studentStartRow}:$B$${studentEndRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'${sheetName}'!$${pctColLetter}$${studentStartRow}:$${pctColLetter}$${studentEndRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:axId val="50000000"/><c:axId val="50000001"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="50000000"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="50000001"/><c:auto val="1"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="50000001"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="0%" sourceLinked="1"/><c:crossAx val="50000000"/>
      </c:valAx>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`;
    zip.file("xl/charts/chart1.xml", chart1Xml);

    if (isBSB) {
      const summaryRow = studentEndRow + 1;
      const firstTaskCol = "C";
      const lastTaskCol = String.fromCharCode(67 + numTasks - 1);

      const chart2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Topshiriqlar bo'yicha o'rtacha ko'rsatkich (%)</a:t></a:r></a:p></c:rich></c:tx>
      <c:layout/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="standard"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:cat><c:strRef><c:f>'${sheetName}'!$${firstTaskCol}$5:$${lastTaskCol}$5</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'${sheetName}'!$${firstTaskCol}$${summaryRow}:$${lastTaskCol}$${summaryRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:axId val="60000000"/><c:axId val="60000001"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="60000000"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="60000001"/><c:auto val="1"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="60000001"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="0%" sourceLinked="1"/><c:crossAx val="60000000"/>
      </c:valAx>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`;
      zip.file("xl/charts/chart2.xml", chart2Xml);
    }

    return await zip.generateAsync({ type: "uint8array" });
  } catch (err) {
    console.error("Error attaching chart xml to zip:", err);
    return excelBuffer;
  }
}

/**
 * Export BSB Results to Excel with official Uzbek school layout
 */
export async function exportBSBToExcel(assessment, results, stats, schoolName = "") {
  const workbook = new ExcelJS.Workbook();
  const sheetName = "BSB Natijalari";
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", xSplit: 2, ySplit: 6 }],
  });

  const numTasks = assessment.tasks.length;
  const numStudents = results.length; // EXACTLY N students!
  const totalCols = 2 + numTasks + 2; // T/r, F.I.Sh, tasks..., Jami, %
  const endColLetter = String.fromCharCode(64 + totalCols);

  // Row 1: School Name Banner
  sheet.mergeCells(`A1:${endColLetter}1`);
  const bannerCell = sheet.getCell("A1");
  bannerCell.value = (schoolName || "MAKTAB NOMI KIRITILMAGAN").toUpperCase();
  bannerCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
  bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  bannerCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  // Row 2: Official Assessment Title Header
  sheet.mergeCells(`A2:${endColLetter}2`);
  const titleCell = sheet.getCell("A2");
  titleCell.value = `${assessment.className}-sinf o'quvchilarining ${assessment.subject} fanidan ${assessment.academicYear}-o'quv yili ${assessment.number}-BSB natijalari jadvallari`;
  titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "1F2937" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  // Row 3: Assessment Information Metadata
  sheet.mergeCells(`A3:${endColLetter}3`);
  const metaCell = sheet.getCell("A3");
  metaCell.value = `O'quv yili: ${assessment.academicYear}   |   O'tkazilgan sana: ${assessment.date}   |   Maksimal ball: ${assessment.maxTotal}`;
  metaCell.font = { name: "Arial", size: 10, italic: true, bold: true, color: { argb: "4B5563" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(3).height = 20;

  // Row 4: Empty spacing row
  sheet.getRow(4).height = 10;

  // Row 5: Main Table Headers
  const taskHeaderLabels = assessment.tasks.map((t) => `${t.number}-topshiriq`);
  const headerRow = sheet.getRow(5);
  headerRow.values = ["T/r", "F.I.Sh", ...taskHeaderLabels, "Jami", "%"];
  headerRow.height = 26;

  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  headerRow.getCell(2).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Row 6: Maximum Score Row
  const maxTaskScores = assessment.tasks.map((t) => t.maxScore);
  const maxRow = sheet.getRow(6);
  maxRow.values = ["Maks", "-", ...maxTaskScores, assessment.maxTotal, 1.0];
  maxRow.height = 22;

  for (let c = 1; c <= totalCols; c++) {
    const cell = maxRow.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "1E40AF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EFF6FF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    if (c === totalCols) {
      cell.numFmt = "0.0%";
    }
  }

  // Rows 7 to 6+N: Student Rows (EXACTLY N rows, no empty rows!)
  results.forEach((result, idx) => {
    const rowNum = 7 + idx;
    const r = sheet.getRow(rowNum);
    const studentScores = assessment.tasks.map((_, i) =>
      result.scores[i] === "" || result.scores[i] === undefined ? "" : Number(result.scores[i])
    );
    const pctVal = (result.percentage || 0) / 100;

    r.values = [idx + 1, result.studentName, ...studentScores, result.total || 0, pctVal];
    r.height = 20;

    // Styling
    for (let c = 1; c <= totalCols; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { horizontal: c === 2 ? "left" : "center", vertical: "middle", indent: c === 2 ? 1 : 0 };

      if (c === totalCols - 1) {
        cell.font = { name: "Arial", size: 10, bold: true };
      } else if (c === totalCols) {
        cell.font = { name: "Arial", size: 10, bold: true };
        cell.numFmt = "0.0%";
      }
    }
  });

  // Row 7+N: Summary / Averages Row
  const summaryRowNum = 7 + numStudents;
  const summaryRow = sheet.getRow(summaryRowNum);
  summaryRow.height = 24;

  const taskAvgs = (stats?.taskAverages || assessment.tasks.map(() => 0)).map((avg) => (parseFloat(avg) || 0) / 100);
  const avgScoreNum = parseFloat(stats?.averageScore) || 0;
  const avgPctNum = (parseFloat(stats?.averagePercentage) || 0) / 100;

  summaryRow.values = ["O'rtacha ko'rsatkich (%)", "", ...taskAvgs, avgScoreNum, avgPctNum];
  sheet.mergeCells(`A${summaryRowNum}:B${summaryRowNum}`);

  for (let c = 1; c <= totalCols; c++) {
    const cell = summaryRow.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E5E7EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };

    if (c >= 3 && c <= 2 + numTasks) {
      cell.numFmt = "0.0%";
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "1D4ED8" } };
    } else if (c === totalCols) {
      cell.numFmt = "0.0%";
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "1D4ED8" } };
    }
  }

  // Apply Borders across full table
  applyTableBorders(sheet, 5, summaryRowNum, 1, totalCols);

  // Column Widths
  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 34;
  for (let i = 3; i <= 2 + numTasks; i++) {
    sheet.getColumn(i).width = 14;
  }
  sheet.getColumn(totalCols - 1).width = 12;
  sheet.getColumn(totalCols).width = 12;

  // Build Excel Buffer & Attach Native OpenXML Chart
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const finalBuffer = await attachNativeChartsToZip(rawBuffer, sheetName, numStudents, numTasks, true);

  const filename = `${assessment.className}_${assessment.subject}_BSB-${assessment.number}.xlsx`;
  downloadBuffer(finalBuffer, filename);
}

/**
 * Export ChSB Results to Excel with official Uzbek school layout
 */
export async function exportChSBToExcel(assessment, results, stats, schoolName = "") {
  const workbook = new ExcelJS.Workbook();
  const sheetName = "ChSB Natijalari";
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", xSplit: 2, ySplit: 6 }],
  });

  const numStudents = results.length; // EXACTLY N students!
  const totalCols = 4; // T/r, F.I.Sh, Jami, %

  // Row 1: School Name Banner
  sheet.mergeCells("A1:D1");
  const bannerCell = sheet.getCell("A1");
  bannerCell.value = (schoolName || "MAKTAB NOMI KIRITILMAGAN").toUpperCase();
  bannerCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
  bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
  bannerCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  // Row 2: Official Assessment Title Header
  sheet.mergeCells("A2:D2");
  const titleCell = sheet.getCell("A2");
  titleCell.value = `${assessment.className}-sinf o'quvchilarining ${assessment.subject} fanidan ${assessment.academicYear}-o'quv yili ${assessment.number}-ChSB natijalari jadvallari`;
  titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "1F2937" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  // Row 3: Assessment Information Metadata
  sheet.mergeCells("A3:D3");
  const metaCell = sheet.getCell("A3");
  metaCell.value = `O'quv yili: ${assessment.academicYear}   |   O'tkazilgan sana: ${assessment.date}   |   Maksimal ball: ${assessment.maxScore}`;
  metaCell.font = { name: "Arial", size: 10, italic: true, bold: true, color: { argb: "4B5563" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(3).height = 20;

  // Row 4: Empty spacing row
  sheet.getRow(4).height = 10;

  // Row 5: Main Table Headers
  const headerRow = sheet.getRow(5);
  headerRow.values = ["T/r", "F.I.Sh", "Jami ball", "%"];
  headerRow.height = 26;

  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  headerRow.getCell(2).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Row 6: Maximum Score Row
  const maxRow = sheet.getRow(6);
  maxRow.values = ["Maks", "-", assessment.maxScore, 1.0];
  maxRow.height = 22;

  for (let c = 1; c <= totalCols; c++) {
    const cell = maxRow.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "1E40AF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EFF6FF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    if (c === totalCols) {
      cell.numFmt = "0.0%";
    }
  }

  // Rows 7 to 6+N: Student Rows (EXACTLY N rows!)
  results.forEach((result, idx) => {
    const rowNum = 7 + idx;
    const r = sheet.getRow(rowNum);
    const scoreVal = result.total === "" || result.total === undefined ? "" : Number(result.total);
    const pctVal = (result.percentage || 0) / 100;

    r.values = [idx + 1, result.studentName, scoreVal, pctVal];
    r.height = 20;

    for (let c = 1; c <= totalCols; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { horizontal: c === 2 ? "left" : "center", vertical: "middle", indent: c === 2 ? 1 : 0 };

      if (c === 3) {
        cell.font = { name: "Arial", size: 10, bold: true };
      } else if (c === 4) {
        cell.font = { name: "Arial", size: 10, bold: true };
        cell.numFmt = "0.0%";
      }
    }
  });

  // Row 7+N: Summary / Averages Row
  const summaryRowNum = 7 + numStudents;
  const summaryRow = sheet.getRow(summaryRowNum);
  summaryRow.height = 24;

  const avgScoreNum = parseFloat(stats?.averageScore) || 0;
  const avgPctNum = (parseFloat(stats?.averagePercentage) || 0) / 100;

  summaryRow.values = ["O'rtacha ko'rsatkich", "", avgScoreNum, avgPctNum];
  sheet.mergeCells(`A${summaryRowNum}:B${summaryRowNum}`);

  for (let c = 1; c <= totalCols; c++) {
    const cell = summaryRow.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E5E7EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };

    if (c === 3 || c === 4) {
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "1D4ED8" } };
      if (c === 4) cell.numFmt = "0.0%";
    }
  }

  // Apply Borders across full table
  applyTableBorders(sheet, 5, summaryRowNum, 1, totalCols);

  // Column Widths
  sheet.getColumn(1).width = 7;
  sheet.getColumn(2).width = 34;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;

  // Build Excel Buffer & Attach Native OpenXML Chart
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const finalBuffer = await attachNativeChartsToZip(rawBuffer, sheetName, numStudents, 0, false);

  const filename = `${assessment.className}_${assessment.subject}_ChSB-${assessment.number}.xlsx`;
  downloadBuffer(finalBuffer, filename);
}
