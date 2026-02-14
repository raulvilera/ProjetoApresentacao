
import { jsPDF } from "jspdf";
import { Incident } from "../types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// URLs das imagens (Desativadas para demonstração)
const LOGO_SP_URL = "";
const LOGO_PEP_URL = "";


const getBase64Image = (url: string): Promise<{ data: string; width: number; height: number }> => {
  return Promise.reject("Modo Demo: Imagens desativadas");
};

export const generateIncidentPDF = async (incident: Incident, action: 'view' | 'download' = 'download') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  let brasaoData = null;
  let PEPData = null;
  try {
    [brasaoData, PEPData] = await Promise.all([
      getBase64Image(LOGO_SP_URL),
      getBase64Image(LOGO_PEP_URL)
    ]);
  } catch (err) {
    console.error("Erro ao carregar logos:", err);
  }

  doc.setDrawColor(0, 43, 92);
  doc.setLineWidth(0.5);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

  // Brasão SP (superior esquerdo)
  if (brasaoData) {
    const targetW = 22;
    const targetH = (brasaoData.height / brasaoData.width) * targetW;
    doc.addImage(brasaoData.data, 'PNG', 12, 12, targetW, targetH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const headerLines = [
    "GOVERNO DO ESTADO DE SÃO PAULO",
    "SECRETARIA DE ESTADO DA EDUCAÇÃO",
    "DIRETORIA DE ENSINO REGIÃO GUARULHOS NORTE – Escola Modelo de Tecnologia",
    "RUA DOREZÓPOLIS, 294 - JARDIM SANTA CLARA – CEP: 07123-120",
    "Cidade - UF | Telefone: (00) 0000-0000"
  ];

  let currentY = 15;
  headerLines.forEach(line => {
    doc.text(line, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4.2;
  });

  currentY += 12;
  doc.setFontSize(14);
  doc.setTextColor(0, 84, 166);

  // Títulos dinâmicos
  let title = "REGISTRO DE OCORRÊNCIA";
  if (incident.category === "MEDIDA EDUCATIVA") {
    title = "COMUNICADO DE MEDIDA EDUCATIVA";
  } else if (incident.category === "OCORRÊNCIA DISCIPLINAR") {
    title = "REGISTRO DE OCORRÊNCIA DISCIPLINAR";
  } else if (incident.category === "OCORRÊNCIA PEDAGÓGICA") {
    title = "REGISTRO DE OCORRÊNCIA PEDAGÓGICA";
  }

  doc.text(title, pageWidth / 2, currentY, { align: 'center' });

  currentY += 15;
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "normal");
  const studentInfo = `Sr(a). responsável pelo(a) aluno(a): ${incident.studentName.toUpperCase()}`;
  const splitStudent = doc.splitTextToSize(studentInfo, contentWidth);
  doc.text(splitStudent, margin, currentY);
  currentY += (splitStudent.length * 6);

  doc.text(`Estudante da turma: ${incident.classRoom || ""}`, margin, currentY);

  currentY += 10;
  const introText = "Viemos por meio deste comunicar que o estudante acima citado foi advertido por atitudes no ambiente escolar. Ressaltamos a importância do convívio harmonioso e o respeito às regras vigentes. Caso o fato se repita, medidas complementares serão aplicadas conforme o regimento escolar.";

  doc.text(introText, margin, currentY, {
    align: 'justify',
    maxWidth: contentWidth
  });

  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  currentY += (splitIntro.length * 5.5) + 10;

  // Data de Retorno apenas para MEDIDA EDUCATIVA
  if (incident.category === "MEDIDA EDUCATIVA") {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 0, 0);
    doc.text(`DATA DE RETORNO ÀS ATIVIDADES: ${incident.returnDate || "___/___/___"}`, margin, currentY);
    currentY += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("RELATO DETALHADO DOS FATOS:", margin, currentY);

  currentY += 4;
  const boxHeight = 50;
  doc.setDrawColor(180, 180, 180);
  doc.rect(margin, currentY, contentWidth, boxHeight);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fullDescription = incident.description.toUpperCase();

  doc.text(fullDescription, margin + 5, currentY + 8, {
    align: 'justify',
    maxWidth: contentWidth - 10
  });

  currentY += boxHeight + 15;
  doc.setFontSize(10.5);
  doc.text(`GUARULHOS, ${incident.date}`, margin, currentY);

  currentY += 25;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const lineSize = 75;

  doc.line(margin, currentY, margin + lineSize, currentY);
  doc.line(pageWidth - margin - lineSize, currentY, pageWidth - margin, currentY);

  currentY += 5;
  doc.setFontSize(8.5);
  doc.text("Assinatura do Aluno", margin + (lineSize / 2), currentY, { align: 'center' });
  doc.text("Assinatura do Responsável", pageWidth - margin - (lineSize / 2), currentY, { align: 'center' });

  currentY += 20;
  doc.line((pageWidth / 2) - 45, currentY, (pageWidth / 2) + 45, currentY);
  currentY += 5;
  doc.text("Assinatura da Direção / Gestão", pageWidth / 2, currentY, { align: 'center' });

  // Logo PEP (inferior direito)
  if (PEPData) {
    const targetW = 25;
    const targetH = (PEPData.height / PEPData.width) * targetW;
    doc.addImage(PEPData.data, 'PNG', pageWidth - targetW - 12, pageHeight - targetH - 12, targetW, targetH);
  }

  if (action === 'view') {
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(`REGISTRO_PEP_${incident.studentName.replace(/\s+/g, '_')}.pdf`);
  }
};

/**
 * Gera um PDF e faz upload para o Supabase Storage.
 * Retorna a URL pública do PDF ou null em caso de erro.
 */
export const uploadPDFToStorage = async (incident: Incident): Promise<string | null> => {
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Supabase não configurado. Upload de PDF cancelado.");
    return null;
  }

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    let brasaoData = null;
    let PEPData = null;
    try {
      [brasaoData, PEPData] = await Promise.all([
        getBase64Image(LOGO_SP_URL),
        getBase64Image(LOGO_PEP_URL)
      ]);
    } catch (err) {
      console.error("Erro ao carregar logos:", err);
    }

    doc.setDrawColor(0, 43, 92);
    doc.setLineWidth(0.5);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    if (brasaoData) {
      const targetW = 22;
      const targetH = (brasaoData.height / brasaoData.width) * targetW;
      doc.addImage(brasaoData.data, 'PNG', 12, 12, targetW, targetH);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const headerLines = [
      "GOVERNO DO ESTADO DE SÃO PAULO",
      "SECRETARIA DE ESTADO DA EDUCAÇÃO",
      "DIRETORIA DE ENSINO REGIÃO GUARULHOS NORTE – Escola Modelo de Tecnologia",
      "RUA DOREZÓPOLIS, 294 - JARDIM SANTA CLARA – CEP: 07123-120",
      "Cidade - UF | Telefone: (00) 0000-0000"
    ];

    let currentY = 15;
    headerLines.forEach(line => {
      doc.text(line, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4.2;
    });

    currentY += 12;
    doc.setFontSize(14);
    doc.setTextColor(0, 84, 166);

    let title = "REGISTRO DE OCORRÊNCIA";
    if (incident.category === "MEDIDA EDUCATIVA") {
      title = "COMUNICADO DE MEDIDA EDUCATIVA";
    } else if (incident.category === "OCORRÊNCIA DISCIPLINAR") {
      title = "REGISTRO DE OCORRÊNCIA DISCIPLINAR";
    } else if (incident.category === "OCORRÊNCIA PEDAGÓGICA") {
      title = "REGISTRO DE OCORRÊNCIA PEDAGÓGICA";
    }

    doc.text(title, pageWidth / 2, currentY, { align: 'center' });

    currentY += 15;
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "normal");
    const studentInfo = `Sr(a). responsável pelo(a) aluno(a): ${incident.studentName.toUpperCase()}`;
    const splitStudent = doc.splitTextToSize(studentInfo, contentWidth);
    doc.text(splitStudent, margin, currentY);
    currentY += (splitStudent.length * 6);

    doc.text(`Estudante da turma: ${incident.classRoom || ""}`, margin, currentY);

    currentY += 10;
    const introText = "Viemos por meio deste comunicar que o estudante acima citado foi advertido por atitudes no ambiente escolar. Ressaltamos a importância do convívio harmonioso e o respeito às regras vigentes. Caso o fato se repita, medidas complementares serão aplicadas conforme o regimento escolar.";

    doc.text(introText, margin, currentY, {
      align: 'justify',
      maxWidth: contentWidth
    });

    const splitIntro = doc.splitTextToSize(introText, contentWidth);
    currentY += (splitIntro.length * 5.5) + 10;

    if (incident.category === "MEDIDA EDUCATIVA") {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text(`DATA DE RETORNO ÀS ATIVIDADES: ${incident.returnDate || "___/___/___"}`, margin, currentY);
      currentY += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("RELATO DETALHADO DOS FATOS:", margin, currentY);

    currentY += 4;
    const boxHeight = 50;
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, currentY, contentWidth, boxHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const fullDescription = incident.description.toUpperCase();

    doc.text(fullDescription, margin + 5, currentY + 8, {
      align: 'justify',
      maxWidth: contentWidth - 10
    });

    currentY += boxHeight + 15;
    doc.setFontSize(10.5);
    doc.text(`GUARULHOS, ${incident.date}`, margin, currentY);

    currentY += 25;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    const lineSize = 75;

    doc.line(margin, currentY, margin + lineSize, currentY);
    doc.line(pageWidth - margin - lineSize, currentY, pageWidth - margin, currentY);

    currentY += 5;
    doc.setFontSize(8.5);
    doc.text("Assinatura do Aluno", margin + (lineSize / 2), currentY, { align: 'center' });
    doc.text("Assinatura do Responsável", pageWidth - margin - (lineSize / 2), currentY, { align: 'center' });

    currentY += 20;
    doc.line((pageWidth / 2) - 45, currentY, (pageWidth / 2) + 45, currentY);
    currentY += 5;
    doc.text("Assinatura da Direção / Gestão", pageWidth / 2, currentY, { align: 'center' });

    if (PEPData) {
      const targetW = 25;
      const targetH = (PEPData.height / PEPData.width) * targetW;
      doc.addImage(PEPData.data, 'PNG', pageWidth - targetW - 12, pageHeight - targetH - 12, targetW, targetH);
    }

    // Converter PDF para Blob
    const pdfBlob = doc.output('blob');

    // Nome do arquivo único
    const fileName = `${incident.id}_${incident.studentName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const filePath = `${fileName}`;

    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from('incident-pdfs')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Erro ao fazer upload do PDF:", error);
      return null;
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('incident-pdfs')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      console.error('❌ Erro: URL pública não foi gerada');
      return null;
    }

    console.log('✅ URL pública gerada:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('❌ Erro ao gerar/enviar PDF:', error);
    return null;
  }
};

