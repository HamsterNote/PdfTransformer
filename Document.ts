import HamsterDocument from '@DocumentKit/Document';
import { PDFDocumentProxy } from 'pdfjs-dist';
import React from 'react';
import { DocumentAnchor } from '@DocumentKit/types/Document';
import HamsterPage from '@DocumentKit/Page';
import PdfPage from '@/plugins/document/transformer/PdfTransformer/Page';

export default class PdfDocument extends HamsterDocument {
	constructor(hash: string, private documentProxy: PDFDocumentProxy) {
		super(hash);
	}
	async init() {}
	async getPage(num: number) {
		const page = new PdfPage(num, this, this.documentProxy);
		await page.init();
		return page;
	}
	getThumbnail(): Promise<string> {
		return Promise.resolve('');
	}
	getOutline(): Promise<{ title: string; style?: React.CSSProperties; anchor?: DocumentAnchor }[]> {
		return Promise.resolve([]);
	}
	getCover(): Promise<string> {
		return this.getPage(1).then(page => page.getBackground({ scale: 1 }));
	}
	async getPages(): Promise<HamsterPage[]> {
		const { numPages } = this.documentProxy;
		const result: HamsterPage[] = [];
		for (let i = 0; i < numPages; i++) {
			result.push(await this.getPage(i + 1));
		}
		return result;
	}
}
