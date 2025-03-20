
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { DocumentTransformer, readDocument } from '@DocumentKit/transformer';
import { Page } from '@DocumentKit/types/Page';
import { Text } from '@DocumentKit/types/Text';
import { Document, DocumentAnchor } from '@DocumentKit/types/Document';
import { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import md5 from 'md5';
import { Number2 } from '@/types/Math';
import { ReactElement } from 'react';
import PdfDocument from '@/plugins/document/transformer/PdfTransformer/Document';
import HamsterDocument from '@DocumentKit/Document';

// @ts-ignore
import('pdfjs-dist/build/pdf.worker.min.mjs').then(src => {
	GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
})



function getPageId(pageNumber: number, docHash: string) {
	return `${docHash}-${pageNumber}`;
}

// 文字含有全角
function isFullWidth(str: string) {
	return [...str.split('')].every(char => !char.match(/[\u0000-\u00ff]/g));
}

type DestWithPosition = [{ num: number; gen: number; }, { name: 'XYZ' }, number, number, number];

async function destToAnchor(pdf: PDFDocumentProxy, pages: string[], dest: DestWithPosition): Promise<DocumentAnchor | undefined> {
	const pageIndex = await pdf.getPageIndex(dest[0]);
	const pageId = pageIndex !== undefined ? pages[pageIndex] : undefined;
	return pageId ? {
		pageId,
		position: {
			x: dest[3],
			y: dest[4],
		},
	} : undefined;
}

export class PdfTransformer extends DocumentTransformer {
	static extension = 'pdf';
	static version = 1;
	private pdfDocProxy: PDFDocumentProxy | undefined;
	private document: PdfDocument | undefined;
	async loadFile(file: File) {
		const pdfArrayBuffer = await readDocument(file);
		const pdf = await getDocument(pdfArrayBuffer).promise;
		this.document = new PdfDocument(this.hash, pdf);
	}
	getDocument() {
		return this.document as HamsterDocument | undefined;
	}
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
		const result = canvas.toDataURL('image/png');
		return result;
	}
	async read(file: File): Promise<void> {
		const pdfArrayBuffer = await readDocument(file);
		const pdf = await getDocument(pdfArrayBuffer).promise;
		this.pdfDocProxy = pdf;
	}
	async getDocument1(): Promise<Document | undefined> {
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return undefined;
		}
		console.log(await pdf.getPageLabels());
		const pageNum = pdf.numPages;
		const pages = new Array(pageNum).fill(0).map((_, index) => getPageId(index + 1, this.hash));
		return {
			id: this.hash,
			pages,
			version: PdfTransformer.version,
			outline: await Promise.all((await pdf.getOutline()).map(async (o) => {
				return {
					title: o.title,
					anchor: o.dest instanceof Array ? await destToAnchor(pdf, pages, o.dest as DestWithPosition) : undefined,
					style: {
						color: `rgb(${o.color[0] || 0},${o.color[1] || 0},${o.color[2] || 0})`,
						fontWeight: o.bold ? 'bold' : undefined,
					},
				};
			})),
		}
	}

	async getPage(index: number): Promise<Page | undefined> {
		// 读取某一页
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return undefined;
		}
		// console.log(await pdf.getAttachments());
		// console.log(await pdf.getOutline());
		// console.log(await pdf.getCalculationOrderIds());
		// console.log(await pdf.getDownloadInfo());
		// console.log(await pdf.getFieldObjects());
		// console.log(await pdf.getMarkInfo());
		// console.log(await pdf.getMetadata());
		const page = await pdf.getPage(index);
		// console.log(await page.getAnnotations());
		// for (const a of await page.getAnnotations()) {
			// console.log(await pdf.getDestination(a.id));
		// }
		// console.log(await page.getStructTree());
		// console.log(await page.getOperatorList());
		// console.log(await page.getJSActions());
		const viewport = page.getViewport({ scale: 1, dontFlip: true });
		const texts = await page.getTextContent();
		// console.log(texts.items);
		const pageId = getPageId(index, this.hash);
		const styles = texts.styles;
		// text偏移基准点
		const originPoint: Number2 = {
			x: viewport.viewBox[0] + viewport.transform[4], y: viewport.viewBox[1] + viewport.transform[5],
		};
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		const pageRender = context && page.render({
			canvasContext: context,
			viewport,
		});
		pageRender?.promise.then(res => {
			console.log(res);
		});
		return {
			id: pageId,
			height: viewport.viewBox[2],
			width: viewport.viewBox[3],
			lang: texts.lang,
			style: {
				background: await this.getPageBg(index),
				// background: `url(${await this.getPageBg(index)}) no-repeat center center / cover`,
			},
			texts: texts.items.map(text => {
				const isTextItem = Object.keys(text).includes('hasEOL') && Object.keys(text).includes('str');
				if (isTextItem) {
					const _text = text as TextItem;
					const currentTextStyles = styles[_text.fontName];
					const fontSize = (_text.transform[0] || 0);
					return {
						id: md5(`${_text.str}-${_text.transform.join(',')}-${_text.width}-${_text.height}`),
						content: _text.str,
						hasEOL: _text.hasEOL,
						lang: texts.lang,
						width: _text.width,
						height: _text.height,
						dir: _text.dir,
						position: {
							x: `${(((_text.transform[4] + viewport.transform[4])) || 0) / viewport.viewBox[2] * 100}%`,
							y: `${(viewport.viewBox[3] - ((_text.transform[5] + viewport.transform[5]) || 0) + 2 - fontSize) / viewport.viewBox[3] * 100}%`,
						},
						style: {
							writingMode: currentTextStyles.vertical ? 'vertical-lr' : undefined,
							transformOrigin: '0px 0px',
							fontSize: fontSize,
							...currentTextStyles,
						},
					};
				} else {
					return undefined;
				}
			}).filter(Boolean) as Text[],
		};
	}

	async renderPage(index: number, textLayer: HTMLDivElement, background: HTMLCanvasElement): Promise<void> {
		// 读取某一页
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return;
		}
		// console.log(await pdf.getAttachments());
		// console.log(await pdf.getOutline());
		// console.log(await pdf.getCalculationOrderIds());
		// console.log(await pdf.getDownloadInfo());
		// console.log(await pdf.getFieldObjects());
		// console.log(await pdf.getMarkInfo());
		// console.log(await pdf.getMetadata());
		const page = await pdf.getPage(index);
		// console.log(await page.getAnnotations());
		// for (const a of await page.getAnnotations()) {
			// console.log(await pdf.getDestination(a.id));
		// }
		// console.log(await page.getStructTree());
		// console.log(await page.getOperatorList());
		// console.log(await page.getJSActions());
		const viewport = page.getViewport({ scale: 1, dontFlip: true });
		// console.log(texts.items);
		const context = background.getContext('2d');
		const pageRender = context && page.render({
			canvasContext: context,
			viewport,
		});
		await pageRender?.promise.then(res => {
			console.log(res);
		});
	}

	async getPageViewport(index: number) {
		// 读取某一页
		const pdf = this.pdfDocProxy;
		if (!pdf) {
			return undefined;
		}
		const page = await pdf.getPage(index);
		const viewport = page.getViewport({ scale: 1 });
		return { width: viewport.width, height: viewport.height };
	}
	async getCover() {
		const cover = await this.getPageBg(1);
		if (cover) {
			return cover;
		}
		return '';
	}
}
