import { BehaviorSubject, combineLatest, from } from 'rxjs'
import { filter, map, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { getBlameDecorations } from './blame'

export interface Settings {
    ['git.blame.decorations']?: 'none' | 'line' | 'file'
    // The following two settings are deprecated, but we will still look for them
    // to 'onboard' users to new setting
    ['git.blame.lineDecorations']?: boolean
    ['git.blame.decorateWholeFile']?: boolean
}

const decorationType = sourcegraph.app?.createDecorationType()

export function activate(context: sourcegraph.ExtensionContext): void {
    // TODO(lguychard) sourcegraph.configuration is currently not rxjs-compatible.
    // Fix this once it has been made compatible.
    const configurationChanges = new BehaviorSubject<void>(undefined)
    context.subscriptions.add(sourcegraph.configuration.subscribe(() => configurationChanges.next(undefined)))

    // Backcompat: Set 'git.blame.decorations' based on previous settings values
    ;(async () => {
        const settings = sourcegraph.configuration.get<Settings>().value
        const initialDecorations = settings['git.blame.decorations']
        if (!initialDecorations) {
            if (settings['git.blame.lineDecorations'] === false) {
                await sourcegraph.commands.executeCommand('updateConfiguration', ['git.blame.decorations'], 'none')
            } else if (settings['git.blame.lineDecorations'] === true) {
                if (settings['git.blame.decorateWholeFile']) {
                    await sourcegraph.commands.executeCommand('updateConfiguration', ['git.blame.decorations'], 'file')
                } else {
                    await sourcegraph.commands.executeCommand('updateConfiguration', ['git.blame.decorations'], 'line')
                }
            } else {
                // Default to 'line'
                await sourcegraph.commands.executeCommand('updateConfiguration', ['git.blame.decorations'], 'line')
            }
        }
    })().catch(() => {
        // noop
    })

    if (sourcegraph.app.activeWindowChanges) {
        const selectionChanges = from(sourcegraph.app.activeWindowChanges).pipe(
            filter((window): window is Exclude<typeof window, undefined> => window !== undefined),
            switchMap(window => window.activeViewComponentChanges),
            filter((editor): editor is sourcegraph.CodeEditor => !!editor && editor.type === 'CodeEditor'),
            switchMap(editor => from(editor.selectionsChanges).pipe(map(selections => ({ editor, selections }))))
        )
        // When the configuration or current file changes, publish new decorations.
        context.subscriptions.add(
            combineLatest(configurationChanges, selectionChanges).subscribe(([, { editor, selections }]) => {
                decorate(editor, selections).catch(() => {
                    // noop
                })
            })
        )
    } else {
        // Backcompat: the extension host does not support activeWindowChanges or CodeEditor.selectionsChanges.
        // When configuration changes or onDidOpenTextDocument fires, add decorations for all blame hunks.
        const activeEditor = (): sourcegraph.CodeEditor | sourcegraph.DirectoryViewer | undefined =>
            sourcegraph.app.activeWindow?.activeViewComponent
        context.subscriptions.add(
            combineLatest(configurationChanges, from(sourcegraph.workspace.openedTextDocuments)).subscribe(() => {
                const editor = activeEditor()
                if (editor && editor.type === 'CodeEditor') {
                    decorate(editor, null).catch(() => {
                        // noop
                    })
                }
            })
        )
    }

    // TODO: Unpublish decorations on previously (but not currently) open files when settings changes, to avoid a
    // brief flicker of the old state when the file is reopened.
    async function decorate(editor: sourcegraph.CodeEditor, selections: sourcegraph.Selection[] | null): Promise<void> {
        const settings = sourcegraph.configuration.get<Settings>().value
        try {
            editor.setDecorations(
                decorationType,
                await getBlameDecorations({
                    uri: editor.document.uri,
                    now: Date.now(),
                    settings,
                    selections,
                    sourcegraph,
                })
            )
        } catch (error) {
            console.error('Decoration error:', error)
        }
    }
}
