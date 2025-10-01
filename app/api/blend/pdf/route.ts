import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blendId } = body;

    if (!blendId) {
      return NextResponse.json(
        { error: 'Blend ID is required' },
        { status: 400 }
      );
    }

    // Get blend data
    const blend = await convex.query(api.blends.getBlendById, { blendId });
    
    if (!blend) {
      return NextResponse.json(
        { error: 'Blend not found' },
        { status: 404 }
      );
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    // Load fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const black = rgb(0, 0, 0);
    const darkGray = rgb(0.2, 0.2, 0.2);

    // Load and embed logo
    let logoImage;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'images', 'Logo-with-text-trans.png');
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (error) {
      console.warn('Could not load logo, using text fallback:', error);
    }

    // Header with logo
    if (logoImage) {
      // Draw logo at the top
      const logoWidth = 200;
      const logoHeight = (logoImage.height * logoWidth) / logoImage.width;
      page.drawImage(logoImage, {
        x: 50,
        y: height - logoHeight - 20,
        width: logoWidth,
        height: logoHeight,
      });
    } else {
      // Fallback to text if logo not available
      page.drawText('HALAL GELATIN PVT. LTD.', {
        x: 50,
        y: height - 50,
        size: 16,
        font: boldFont,
        color: black,
      });

      page.drawText('Serving Health', {
        x: 50,
        y: height - 70,
        size: 12,
        font: font,
        color: darkGray,
      });
    }

    // Calculate logo height for positioning
    const logoHeight = logoImage ? (logoImage.height * 200) / logoImage.width : 0;
    const contentStartY = logoImage ? height - logoHeight - 60 : height - 120;

    // Title
    page.drawText('BLENDING SHEET', {
      x: 50,
      y: contentStartY,
      size: 20,
      font: boldFont,
      color: black,
    });

    // Date
    const dateText = `Date: ${new Date(blend.date).toLocaleDateString('en-GB')}`;
    const dateWidth = font.widthOfTextAtSize(dateText, 12);

    page.drawText(dateText, {
      x: width - 50 - dateWidth,
      y: contentStartY,
      size: 12,
      font: font,
      color: black,
    });

    // SR number
    const srText = `SR #: ${blend.serialNumber}`;
    const srWidth = font.widthOfTextAtSize(srText, 12);
    page.drawText(srText, {
      x: width - 50 - srWidth,
      y: contentStartY - 20,
      size: 12,
      font: font,
      color: black,
    });

    // Lot number
    const lotText = `Lot #: ${blend.lotNumber}`;
    const lotWidth = font.widthOfTextAtSize(lotText, 12);
    page.drawText(lotText, {
      x: width - 50 - lotWidth,
      y: contentStartY - 40,
      size: 12,
      font: font,
      color: black,
    });

    // Target specifications
    page.drawText(`Blending Bloom: ${blend.targetBloomMin}-${blend.targetBloomMax}`, {
      x: 50,
      y: contentStartY - 60,
      size: 12,
      font: font,
      color: black,
    });

    // Target mean bloom is intentionally omitted from the PDF.

    if (blend.targetMesh) {
      page.drawText(`Mesh: ${blend.targetMesh}`, {
        x: 50,
        y: contentStartY - 80,
        size: 12,
        font: font,
        color: black,
      });
    }

    // Table header
    const tableY = contentStartY - 110;
    const colWidths = [60, 100, 80, 80];
    const colX = [50, 110, 210, 290];

    // Draw table header
    page.drawText('S.No.', {
      x: colX[0],
      y: tableY,
      size: 12,
      font: boldFont,
      color: black,
    });

    page.drawText('Batch NO.', {
      x: colX[1],
      y: tableY,
      size: 12,
      font: boldFont,
      color: black,
    });

    page.drawText('Bloom', {
      x: colX[2],
      y: tableY,
      size: 12,
      font: boldFont,
      color: black,
    });

    page.drawText('Bags', {
      x: colX[3],
      y: tableY,
      size: 12,
      font: boldFont,
      color: black,
    });

    // Draw table rows
    let currentY = tableY - 30;
    blend.selectedBatches.forEach((batch: any, index: number) => {
      page.drawText((index + 1).toString(), {
        x: colX[0],
        y: currentY,
        size: 10,
        font: font,
        color: black,
      });

      const batchLabel = `${batch.batchNumber}${batch.isOutsource ? ' (O)' : ''}`;
      page.drawText(batchLabel, {
        x: colX[1],
        y: currentY,
        size: 10,
        font: font,
        color: black,
      });

      page.drawText((batch.bloom || 0).toString(), {
        x: colX[2],
        y: currentY,
        size: 10,
        font: font,
        color: black,
      });

      page.drawText(batch.bags.toString(), {
        x: colX[3],
        y: currentY,
        size: 10,
        font: font,
        color: black,
      });

      currentY -= 20;
    });

    // Total row
    currentY -= 10;
    page.drawText('TOTAL', {
      x: colX[0],
      y: currentY,
      size: 12,
      font: boldFont,
      color: black,
    });

    // Calculate total bloom (sum of all bloom values)
    const totalBloom = blend.selectedBatches.reduce((sum, batch) => sum + (batch.bloom || 0), 0);
    page.drawText(totalBloom.toString(), {
      x: colX[2],
      y: currentY,
      size: 12,
      font: boldFont,
      color: black,
    });

    page.drawText(blend.totalBags.toString(), {
      x: colX[3],
      y: currentY,
      size: 12,
      font: boldFont,
      color: black,
    });

    // Summary section
    const summaryY = currentY - 40;
    page.drawText(`Average Bloom: ${blend.averageBloom}` , {
      x: 50,
      y: summaryY,
      size: 12,
      font: font,
      color: black,
    });

    page.drawText(`Weight (Kg): ${blend.totalWeight.toLocaleString()}`, {
      x: 50,
      y: summaryY - 20,
      size: 12,
      font: font,
      color: black,
    });

    // Additional targets (only if present) - below average bloom
    let additionalY = summaryY - 40;
    if ((blend as any).averageViscosity !== undefined) {
      page.drawText(`Average Viscosity: ${(blend as any).averageViscosity}` , {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetViscosity !== undefined) {
      page.drawText(`Target Viscosity: ${blend.targetViscosity}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetPercentage !== undefined) {
      page.drawText(`Target Percentage: ${blend.targetPercentage}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetPh !== undefined) {
      page.drawText(`Target pH: ${blend.targetPh}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetConductivity !== undefined) {
      page.drawText(`Target Conductivity: ${blend.targetConductivity}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetMoisture !== undefined) {
      page.drawText(`Target Moisture: ${blend.targetMoisture}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetH2o2 !== undefined) {
      page.drawText(`Target H2O2: ${blend.targetH2o2}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetSo2 !== undefined) {
      page.drawText(`Target SO2: ${blend.targetSo2}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetColor !== undefined) {
      page.drawText(`Target Color: ${blend.targetColor}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetClarity !== undefined) {
      page.drawText(`Target Clarity: ${blend.targetClarity}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }
    if (blend.targetOdour !== undefined) {
      page.drawText(`Target Odour: ${blend.targetOdour}`, {
        x: 50,
        y: additionalY,
        size: 12,
        font: font,
        color: black,
      });
      additionalY -= 20;
    }

    // Notes section
    let notesY = additionalY - 20;
    if (blend.notes && blend.notes.trim()) {
      page.drawText('Notes:', {
        x: 50,
        y: notesY,
        size: 12,
        font: boldFont,
        color: black,
      });
      
      // Split notes into multiple lines if too long
      const maxWidth = 500;
      const words = blend.notes.split(' ');
      let currentLine = '';
      let lineY = notesY - 20;
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, 10);
        
        if (testWidth > maxWidth && currentLine) {
          page.drawText(currentLine, {
            x: 50,
            y: lineY,
            size: 10,
            font: font,
            color: black,
          });
          currentLine = word;
          lineY -= 15;
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw the last line
      if (currentLine) {
        page.drawText(currentLine, {
          x: 50,
          y: lineY,
          size: 10,
          font: font,
          color: black,
        });
        lineY -= 15;
      }
      
      notesY = lineY - 20;
    }

    // Review section
    page.drawText('Reviewed By:', {
      x: 50,
      y: notesY,
      size: 12,
      font: font,
      color: black,
    });

    if (blend.reviewedBy) {
      page.drawText(blend.reviewedBy, {
        x: 150,
        y: notesY,
        size: 12,
        font: font,
        color: black,
      });
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    // Return PDF as response
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="blending-sheet-${blend.lotNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
