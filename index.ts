
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { DocumentTransformer, readDocument } from '@DocumentKit/transformer';
import { Page } from '@DocumentKit/types/Page';
import { Text } from '@DocumentKit/types/Text';
import { Document, DocumentAnchor } from '@DocumentKit/types/Document';
import { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import md5 from 'md5';

// @ts-ignore
import('pdfjs-dist/build/pdf.worker.min.mjs').then(src => {
	GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
})

function getPageId(pageNumber: number, docHash: string) {
	return `${docHash}-${pageNumber}`;
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
		console.log(await pdf.getAttachments());
		console.log(await pdf.getOutline());
		console.log(await pdf.getCalculationOrderIds());
		console.log(await pdf.getDownloadInfo());
		console.log(await pdf.getFieldObjects());
		console.log(await pdf.getMarkInfo());
		console.log(await pdf.getMetadata());
		const page = await pdf.getPage(index);
		console.log(await page.getAnnotations());
		for (const a of await page.getAnnotations()) {
			console.log(await pdf.getDestination(a.id));
		}
		console.log(await page.getStructTree());
		console.log(await page.getOperatorList());
		console.log(await page.getJSActions());
		const viewport = page.getViewport({ scale: 1 });
		const texts = await page.getTextContent();
		console.log(texts.items);
		const pageId = getPageId(index, this.hash);
		const styles = texts.styles;
		return {
			id: pageId,
			height: viewport.height,
			width: viewport.width,
			lang: texts.lang,
			texts: texts.items.map(text => {
				const isTextItem = Object.keys(text).includes('hasEOL') && Object.keys(text).includes('str');
				if (isTextItem) {
					const _text = text as TextItem;
					const currentTextStyles = styles[_text.fontName];
					return {
						id: md5(`${_text.str}-${_text.transform.join(',')}-${_text.width}-${_text.height}`),
						content: _text.str,
						hasEOL: _text.hasEOL,
						lang: texts.lang,
						width: _text.width,
						height: _text.height,
						dir: _text.dir,
						position: {
							x: 0,
							y: 0,
						},
						style: {
							writingMode: currentTextStyles.vertical ? 'vertical-lr' : undefined,
							transform: `matrix(${_text.transform.join(',')})`,
							...currentTextStyles,
						},
					};
				} else {
					return undefined;
				}
			}).filter(Boolean) as Text[],
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
