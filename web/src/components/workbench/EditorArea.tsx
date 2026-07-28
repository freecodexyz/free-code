import type React from 'react'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'

export function EditorArea() {
  const editorTabs = useWorkspaceState(s => s.editorTabs)
  const activeEditorTab = useWorkspaceState(s => s.activeEditorTab)
  const setState = useSetWorkspaceState()

  const handleTabClick = (tabId: string) => {
    setState(prev => ({
      ...prev,
      activeEditorTab: tabId,
      editorTabs: prev.editorTabs.map(t => ({ ...t, isActive: t.id === tabId })),
    }))
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    setState(prev => {
      const newTabs = prev.editorTabs.filter(t => t.id !== tabId)
      const newActive = prev.activeEditorTab === tabId
        ? (newTabs[0]?.id ?? null)
        : prev.activeEditorTab
      return {
        ...prev,
        editorTabs: newTabs.map((t, _i) => ({ ...t, isActive: t.id === newActive })),
        activeEditorTab: newActive,
      }
    })
  }

  return (
    <div className="cc-editor-area" style={{ gridColumn: 3, gridRow: 2, display: 'flex', flexDirection: 'column', background: 'var(--bg-base-default)', overflow: 'hidden' }}>
      <div className="ds-editortabs">
        {editorTabs.map(tab => (
          <div
            key={tab.id}
            className={`ds-editortab${tab.id === activeEditorTab ? ' is-active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="ic">
              <img src="/assets/icons/file.svg" width={14} height={14} alt="" />
            </span>
            <span>{tab.name}</span>
            <span className="close" onClick={e => handleTabClose(e, tab.id)}>
              <img src="/assets/icons/x.svg" width={12} height={12} alt="" />
            </span>
          </div>
        ))}
        <div className="ds-editortabs__spacer" />
        <div className="ds-editortabs__actions">
          <button title="分屏编辑">
            <img src="/assets/icons/columns.svg" width={16} height={16} alt="" />
          </button>
          <button title="更多操作">
            <img src="/assets/icons/more-h.svg" width={16} height={16} alt="" />
          </button>
        </div>
      </div>

      <div className="cc-editor-content" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        未打开文件
      </div>
    </div>
  )
}
