import PdfDocument from './Document';
import { PDFDocumentProxy, PDFPageProxy, TextLayer } from 'pdfjs-dist';
import HamsterPage from '@DocumentKit/Page';

export default class PdfPage extends HamsterPage {
	private page: PDFPageProxy | undefined;
	constructor(
		private pageNum: number,
		private document: PdfDocument,
		private documentProxy: PDFDocumentProxy,
	) {
		super();
	}
	async init() {
		this.page = await this.documentProxy.getPage(this.pageNum);
	}
	async getViewport({ scale }: { scale: number }): Promise<{ width: number; height: number } | undefined> {
		const viewport = this.page?.getViewport({ scale });
		return viewport && { width: viewport.width, height: viewport.height};
	}
	async getNumber(): Promise<number> {
		return this.pageNum;
	}
	async getBackground({
		scale
	}: { scale: number }) {
		const canvas = document.createElement('canvas');
		if (this.page) {
			const viewport = this.page.getViewport({ scale });
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				await this.page.render({
					canvasContext: ctx,
					viewport: this.page.getViewport({ scale }),
				}).promise;
				return canvas.toDataURL();
			}
		}
		return '';
	}
	async getTextLayer({
		scale
	}: { scale: number }) {
		const textLayerDiv = document.createElement('div');
		textLayerDiv.style.setProperty('--scale-factor', scale.toString());

		const page = this.page;
		if (!page) {
			return textLayerDiv;
		}
		const textContent = await page.getTextContent();
		const textLayer = new TextLayer({
			textContentSource: textContent,
			viewport: page.getViewport({ scale }),
			container: textLayerDiv,
		});

		await textLayer.render();
		Array.from(textLayerDiv.children).forEach(children => {
			if (children.tagName === 'SPAN') {
				(children as HTMLSpanElement).style.setProperty('transform-origin', '0 0');
			}
		});
		return textLayerDiv;
	}
}
