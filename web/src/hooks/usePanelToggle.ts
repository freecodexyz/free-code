import { useWorkspaceState, useSetWorkspaceState } from '../state/WorkspaceState.js'

export function usePanelToggle() {
  const sidebarOpen = useWorkspaceState(s => s.sidebarOpen)
  const chatPanelOpen = useWorkspaceState(s => s.chatPanelOpen)
  const setState = useSetWorkspaceState()

  const toggleSidebar = () => {
    setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }))
  }

  const toggleChatPanel = () => {
    setState(prev => ({ ...prev, chatPanelOpen: !prev.chatPanelOpen }))
  }

  return { sidebarOpen, chatPanelOpen, toggleSidebar, toggleChatPanel }
}
