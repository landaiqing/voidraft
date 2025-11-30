/**
 * A single source of truth for all the classes used for decorations in Ixora.
 *  These are kept together here to simplify changing/adding classes later
 * and serve as a reference.
 *
 * Exports under this file don't need to follow any particular naming schema,
 * naming which can give an intuition on what the class is for is preferred.
 */

/** Classes for blockquote decorations. */
export const blockquote = {
		/** Blockquote widget */
		widget: 'cm-blockquote',
		/** Replace decoration for the quote mark */
		mark: 'cm-blockquote-border'
	},
	/** Classes for codeblock decorations. */
	codeblock = {
		/** Codeblock widget */
		widget: 'cm-codeblock',
		/** First line of the codeblock widget */
		widgetBegin: 'cm-codeblock-begin',
		/** Last line of the codeblock widget */
		widgetEnd: 'cm-codeblock-end'
	},
	/** Classes for heading decorations. */
	heading = {
		/** Heading decoration class */
		heading: 'cm-heading',
		/** Heading levels (h1, h2, etc) */
		level: (level: number) => `cm-heading-${level}`,
		/** Heading slug */
		slug: (slug: string) => `cm-heading-slug-${slug}`
	},
	/** Classes for link (URL) widgets. */
	link = {
		/** URL widget */
		widget: 'cm-link'
	},
	/** Classes for list widgets. */
	list = {
		/** List bullet */
		bullet: 'cm-list-bullet',
		/** List task checkbox */
		taskCheckbox: 'cm-task-marker-checkbox',
		/** Task list item with checkbox checked */
		taskChecked: 'cm-task-checked'
	},
	/** Classes for image widgets. */
	image = {
		/** Image preview */
		widget: 'cm-image'
	},
	/** Classes for enhanced code block decorations. */
	codeblockEnhanced = {
		/** Code block info container */
		info: 'cm-code-block-info',
		/** Language label */
		lang: 'cm-code-block-lang',
		/** Copy button */
		copyBtn: 'cm-code-block-copy-btn'
	},
	/** Classes for table decorations. */
	table = {
		/** Table container wrapper */
		wrapper: 'cm-table-wrapper',
		/** The rendered table element */
		table: 'cm-table',
		/** Table header row */
		header: 'cm-table-header',
		/** Table header cell */
		headerCell: 'cm-table-header-cell',
		/** Table body */
		body: 'cm-table-body',
		/** Table data row */
		row: 'cm-table-row',
		/** Table data cell */
		cell: 'cm-table-cell',
		/** Cell alignment classes */
		alignLeft: 'cm-table-align-left',
		alignCenter: 'cm-table-align-center',
		alignRight: 'cm-table-align-right',
		/** Cell content wrapper (for editing) */
		cellContent: 'cm-table-cell-content',
		/** Resize handle */
		resizeHandle: 'cm-table-resize-handle',
		/** Active editing cell */
		cellActive: 'cm-table-cell-active',
		/** Row hover state */
		rowHover: 'cm-table-row-hover',
		/** Selected cell */
		cellSelected: 'cm-table-cell-selected'
	}

