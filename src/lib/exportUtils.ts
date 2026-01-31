import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export interface ReportData {
  headers: string[];
  rows: (string | number)[][];
  title: string;
  subtitle?: string;
}

export function exportToPDF(data: ReportData, filename: string) {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 14, 22);
  
  // Add subtitle with date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const dateStr = data.subtitle || `Gerado em ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: pt })}`;
  doc.text(dateStr, 14, 30);
  
  // Add table
  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: 40,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });
  
  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} | Pica-Ponto Pro`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}.pdf`);
}

export function exportToExcel(data: ReportData, filename: string) {
  // Create worksheet data with headers
  const wsData = [data.headers, ...data.rows];
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  const colWidths = data.headers.map((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...data.rows.map(row => String(row[i] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
