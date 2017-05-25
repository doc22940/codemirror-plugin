'use strict';

import emmetExpandAbbreviation from './lib/commands/expand-abbreviation';
import emmetInsertLineBreak from './lib/commands/formatted-line-break';
import {
	markOnEditorChange, findMarker, markAbbreviation, clearMarkers
} from './lib/abbreviation-marker';
import autocompleteProvider from './lib/autocomplete';
import { extractAbbreviation, createAbbreviationModel } from './lib/expand-abbreviation';

const commands = { emmetExpandAbbreviation, emmetInsertLineBreak };

/**
 * Registers Emmet extension on given CodeMirror constructor.
 * This file is designed to be imported somehow into the app (CommonJS, ES6,
 * Rollup/Webpack/whatever). If you simply want to add a <script> into your page
 * that registers Emmet extension on global CodeMirror constructor, use
 * `browser.js` instead
 */
export default function registerEmmetExtension(CodeMirror) {
	// Register Emmet commands
	Object.assign(CodeMirror.commands, commands);

	// Defines options that allows abbreviation marking in text editor
	CodeMirror.defineOption('markEmmetAbbreviation', true, (editor, value) => {
		if (value) {
			editor.on('change', markOnEditorChange);
		} else {
			editor.off('change', markOnEditorChange);
			clearMarkers(editor);
		}
	});

	// Additional options for Emmet, for Expand Abbreviation action mostly:
	// https://github.com/emmetio/expand-abbreviation/blob/master/index.js#L26
	CodeMirror.defineOption('emmet', {});

	/**
	 * Returns context Emmet completions.
	 * Abbreviations are calculated for marked abbreviation at given position.
	 * If no parsed abbreviation marker is available and `force` argument is
	 * given, tries to mark abbreviation and populate completions list again.
	 * @param  {CodeMirror.Pos} [pos]
	 * @param  {Boolean}        [force]
	 * @return {EmmetCompletion[]}
	 */
	CodeMirror.defineExtension('getEmmetCompletions', function(pos, force) {
		const editor = this;
		if (typeof pos === 'boolean') {
			force = pos;
			pos = null;
		}

		let abbrRange, list;

		pos = pos || editor.getCursor();
		if (editor.getOption('markEmmetAbbreviation')) {
			// Get completions from auto-inserted marker
			const marker = findMarker(editor, pos) || (force && markAbbreviation(editor, pos, true));
			if (marker) {
				abbrRange = marker.find();
				list = autocompleteProvider(editor, marker.model, abbrRange.from, pos);
			}
		} else {
			// No abbreviation auto-marker, try to extract abbreviation from given
			// cursor location
			const extracted = extractAbbreviation(editor, pos);
			if (extracted) {
				const model = createAbbreviationModel(extracted.abbreviation, editor);
				if (model) {
					abbrRange = {
						from: { line: pos.line, ch: extracted.location },
						to: {line: pos.line, ch: extracted.location + extracted.abbreviation.length }
					};
					list = autocompleteProvider(editor, model, abbrRange.from, pos);
				}
			}
		}

		if (list && list.length) {
			return {
				from: abbrRange.from,
				to: abbrRange.to,
				list
			};
		}
	});

	CodeMirror.registerHelper('emmet', 'completions', editor => {
		const pos = editor.getCursor();
		const marker = findMarker(editor, pos);
		const markeRange = marker.find();

		return {
			from: markeRange.from,
			to: markeRange.to,
			list: autocompleteProvider(editor, pos)
		};
	});

	CodeMirror.registerHelper('emmet', 'clearMarkers', clearMarkers);
}
