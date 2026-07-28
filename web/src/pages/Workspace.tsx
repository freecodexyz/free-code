import { usePanelToggle } from '../hooks/usePanelToggle.js'
import { Titlebar } from '../components/workbench/Titlebar.js'
import { ActivityRail } from '../components/workbench/ActivityRail.js'
import { Sidebar } from '../components/workbench/Sidebar.js'
import { EditorArea } from '../components/workbench/EditorArea.js'
import { ChatPanel } from '../components/workbench/ChatPanel.js'
import { StatusBar } from '../components/workbench/StatusBar.js'

export function Workspace() {
  const { sidebarOpen, chatPanelOpen } = usePanelToggle()

  const sidebarWidth = sidebarOpen ? '260px' : '0px'
  const chatWidth = chatPanelOpen ? 'minmax(0, 480px)' : '0px'

  return (
    <div
      className="cc-workbench"
      style={{
        display: 'grid',
        gridTemplateRows: '40px 1fr 24px',
        gridTemplateColumns: `48px ${sidebarWidth} 1fr ${chatWidth}`,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Titlebar />
      <ActivityRail />
      {sidebarOpen && <Sidebar />}
      <EditorArea />
      {chatPanelOpen && <ChatPanel />}
      <StatusBar />
    </div>
  )
}
