import expect from 'expect'
import {
    getAllBlameDecorations,
    getBlameDecorations,
    getBlameDecorationsForSelections,
    getDecorationFromHunk,
    Hunk,
} from './blame'
import { createMockSourcegraphAPI } from './util/stubs'

const FIXTURE_HUNK_1: Hunk = {
    startLine: 1,
    endLine: 2,
    author: {
        person: {
            displayName: 'a',
        },
        date: '2018-09-10T21:52:45Z',
    },
    rev: 'b',
    message: 'c',
    commit: {
        url: 'd',
    },
}

const FIXTURE_HUNK_2: Hunk = {
    startLine: 2,
    endLine: 3,
    author: {
        person: {
            displayName: 'e',
        },
        date: '2018-11-10T21:52:45Z',
    },
    rev: 'f',
    message: 'g',
    commit: {
        url: 'h',
    },
}

const FIXTURE_HUNK_3: Hunk = {
    startLine: 3,
    endLine: 4,
    author: {
        person: {
            displayName: 'i',
        },
        date: '2018-10-10T21:52:45Z',
    },
    rev: 'j',
    message: 'k',
    commit: {
        url: 'l',
    },
}

const NOW = +new Date('2018-12-01T21:52:45Z')

const SOURCEGRAPH = createMockSourcegraphAPI()

describe('getDecorationsFromHunk()', () => {
    it('creates a TextDocumentDecoration from a Hunk', () => {
        expect(getDecorationFromHunk(FIXTURE_HUNK_1, NOW, 0, SOURCEGRAPH as any)).toEqual({
            after: {
                contentText: 'a, 3 months ago: • c',
                dark: {
                    backgroundColor: 'rgba(15, 43, 89, 0.65)',
                    color: 'rgba(235, 235, 255, 0.55)',
                },
                hoverMessage: 'c',
                light: {
                    backgroundColor: 'rgba(193, 217, 255, 0.65)',
                    color: 'rgba(0, 0, 25, 0.55)',
                },
                linkURL: 'https://sourcegraph.test/d',
            },
            isWholeLine: true,
            range: {
                end: 0,
                start: 0,
            },
        })
    })

    it('truncates long commit messsages', () => {
        const decoration = getDecorationFromHunk(
            {
                ...FIXTURE_HUNK_1,
                message: 'asdgjdsag asdklgbasdghladg asdgjlhbasdgjlhabsdg asdgilbadsgiobasgd',
            },
            NOW,
            0,
            SOURCEGRAPH as any
        )
        expect(decoration.after && decoration.after.contentText).toEqual(
            'a, 3 months ago: • asdgjdsag asdklgbasdghladg asdgjlhbasdgjlhabs…'
        )
    })

    it('truncates long display names', () => {
        const decoration = getDecorationFromHunk(
            {
                ...FIXTURE_HUNK_1,
                author: {
                    person: {
                        displayName: 'asdgjdsag asdklgbasdghladg asdgjlhbasdgjlhabsdg asdgilbadsgiobasgd',
                    },
                    date: '2018-09-10T21:52:45Z',
                },
            },
            NOW,
            0,
            SOURCEGRAPH as any
        )
        expect(decoration.after && decoration.after.contentText).toEqual(
            'asdgjdsag asdklgbasdghlad…, 3 months ago: • c'
        )
    })
})

describe('getBlameDecorationsForSelections()', () => {
    it('adds decorations only for hunks that are within the selections', () => {
        const decorations = getBlameDecorationsForSelections(
            [FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3],
            [new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(1, 0), new SOURCEGRAPH.Position(1, 0)) as any],
            NOW,
            SOURCEGRAPH as any
        )
        expect(decorations).toEqual([getDecorationFromHunk(FIXTURE_HUNK_2, NOW, 1, SOURCEGRAPH as any)])
    })

    it('handles multiple selections', () => {
        const decorations = getBlameDecorationsForSelections(
            [FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3],
            [
                new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(1, 0), new SOURCEGRAPH.Position(1, 0)) as any,
                new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(2, 0), new SOURCEGRAPH.Position(5, 0)) as any,
                new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(6, 0), new SOURCEGRAPH.Position(10, 0)) as any,
            ],
            NOW,
            SOURCEGRAPH as any
        )
        expect(decorations).toEqual([
            getDecorationFromHunk(FIXTURE_HUNK_2, NOW, 1, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_3, NOW, 2, SOURCEGRAPH as any),
        ])
    })

    it('handles multiple hunks per selection', () => {
        const decorations = getBlameDecorationsForSelections(
            [FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3],
            [new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(0, 0), new SOURCEGRAPH.Position(5, 0)) as any],
            NOW,
            SOURCEGRAPH as any
        )
        expect(decorations).toEqual([
            getDecorationFromHunk(FIXTURE_HUNK_1, NOW, 0, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_2, NOW, 1, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_3, NOW, 2, SOURCEGRAPH as any),
        ])
    })

    it('decorates the start line of the selection if the start line of the hunk is outside of the selection boundaries', () => {
        const decorations = getBlameDecorationsForSelections(
            [
                {
                    ...FIXTURE_HUNK_1,
                    startLine: 1,
                    endLine: 10,
                },
            ],
            [new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(2, 0), new SOURCEGRAPH.Position(2, 0)) as any],
            NOW,
            SOURCEGRAPH as any
        )
        expect(decorations).toEqual([getDecorationFromHunk(FIXTURE_HUNK_1, NOW, 2, SOURCEGRAPH as any)])
    })
})

describe('getAllBlameDecorations()', () => {
    it('adds decorations for all hunks', () => {
        expect(
            getAllBlameDecorations([FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3], NOW, SOURCEGRAPH as any)
        ).toEqual([
            getDecorationFromHunk(FIXTURE_HUNK_1, NOW, 0, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_2, NOW, 1, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_3, NOW, 2, SOURCEGRAPH as any),
        ])
    })
})

describe('getBlameDecorations()', () => {
    it('gets no decorations if git.blame.lineDecorations is false', async () => {
        expect(
            await getBlameDecorations({
                uri: 'a',
                settings: {
                    'git.blame.lineDecorations': false,
                },
                now: NOW,
                selections: null,
                queryHunks: () => Promise.resolve([FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3]),
                sourcegraph: SOURCEGRAPH as any,
            })
        ).toEqual([])
    })

    it('gets decorations for all hunks if no selections are passed', async () => {
        expect(
            await getBlameDecorations({
                uri: 'a',
                settings: {
                    'git.blame.lineDecorations': true,
                },
                now: NOW,
                selections: null,
                queryHunks: () => Promise.resolve([FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3]),
                sourcegraph: SOURCEGRAPH as any,
            })
        ).toEqual([
            getDecorationFromHunk(FIXTURE_HUNK_1, NOW, 0, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_2, NOW, 1, SOURCEGRAPH as any),
            getDecorationFromHunk(FIXTURE_HUNK_3, NOW, 2, SOURCEGRAPH as any),
        ])
    })

    it('gets decorations for the selections if selections are passed', async () => {
        expect(
            await getBlameDecorations({
                uri: 'a',
                settings: {
                    'git.blame.lineDecorations': true,
                },
                now: NOW,
                selections: [
                    new SOURCEGRAPH.Selection(new SOURCEGRAPH.Position(2, 0), new SOURCEGRAPH.Position(2, 0)) as any,
                ],
                queryHunks: () => Promise.resolve([FIXTURE_HUNK_1, FIXTURE_HUNK_2, FIXTURE_HUNK_3]),
                sourcegraph: SOURCEGRAPH as any,
            })
        ).toEqual([getDecorationFromHunk(FIXTURE_HUNK_3, NOW, 2, SOURCEGRAPH as any)])
    })
})