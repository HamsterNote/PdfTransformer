
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { DocumentTransformer, readDocument } from '@DocumentKit/transformer';
import { Page } from '@DocumentKit/types/Page';
import { Document } from '@DocumentKit/types/Document';

// @ts-ignore
import('pdfjs-dist/build/pdf.worker.min.mjs').then(src => {
	GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
})

export class PdfTransformer extends DocumentTransformer {
	static extension = 'pdf';
	static version = 1;
	private pdfDocProxy: PDFDocumentProxy | undefined;
	private async getPageBg(pageNumber: number): Promise<string | undefined> {
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return undefined;
		}
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) {
			return undefined;
		}
		const page = await pdf.getPage(pageNumber);
		const viewport = page.getViewport({ scale: 1 });
		canvas.height = viewport.height;
		canvas.width = viewport.width;
		// 设置渲染的上下文
		const renderContext = {
			canvasContext: context,
			viewport: viewport
		};
		await page.render(renderContext).promise;
		// 将Canvas转换为图片的DataURL
		return canvas.toDataURL('image/png');
	}
	async read(file: File): Promise<void> {
		const pdfArrayBuffer = await readDocument(file);
		const pdf = await getDocument(pdfArrayBuffer).promise;
		this.pdfDocProxy = pdf;
	}
	async getDocument(): Promise<Document | undefined> {
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return undefined;
		}
		const pageNum = pdf.numPages;
		return {
			id: this.hash,
			pages: new Array(pageNum).fill(0).map((_, index) => `${this.hash}-${index}`),
			version: PdfTransformer.version,
		}
	}

	async getPage(): Promise<Page | undefined> {
		return {
			id: `page-123123`,
			height: 0,
			width: 0,
			texts: [],
		};
	}
	async getCover() {
		const cover = await this.getPageBg(1);
		if (cover) {
			return cover;
		}
		return '';
	}
}
