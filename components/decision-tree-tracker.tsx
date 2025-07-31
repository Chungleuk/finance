"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Play,
  Save,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Edit,
  Check,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Calendar,
  Clock,
  DollarSign,
  Target,
  BarChart3,
} from "lucide-react"
import { decisionTree, calculateValue, formatCurrency, formatDateTime, calculateDuration } from "@/lib/decision-tree"
import type { SessionData, PathValue } from "@/lib/types"

export default function DecisionTreeTracker() {
  const [currentNode, setCurrentNode] = useState("Start")
  const [currentPath, setCurrentPath] = useState(["Start"])
  const [initialAmount, setInitialAmount] = useState(100000)
  const [runningTotal, setRunningTotal] = useState(0)
  const [pathValues, setPathValues] = useState<PathValue[]>([])
  const [sessionId, setSessionId] = useState("")
  const [sessionName, setSessionName] = useState("")
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [lastActionTimestamp, setLastActionTimestamp] = useState<Date | null>(null)
  const [isGameActive, setIsGameActive] = useState(false)
  const [sessionHistory, setSessionHistory] = useState<any[]>([])
  const [incompleteSessions, setIncompleteSessions] = useState<any[]>([])
  const [sessionNotes, setSessionNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // New states for confirmation dialog and note editing
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingChoice, setPendingChoice] = useState<"win" | "loss" | null>(null)
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [tempNote, setTempNote] = useState("")

  // States for session history management
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [sessionDetails, setSessionDetails] = useState<Record<string, any>>({})

  // States for search and filter
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [resultFilter, setResultFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  // States for editing session names
  const [editingSessionName, setEditingSessionName] = useState<string | null>(null)
  const [tempSessionName, setTempSessionName] = useState("")

  // State for feature availability
  const [hasSessionNameFeature, setHasSessionNameFeature] = useState(true)

  const node = decisionTree[currentNode]
  const currentStake = calculateValue(node.value, initialAmount)
  const progress = node.level === "END" ? 100 : ((node.level as number) / 10) * 100

  useEffect(() => {
    loadSessionHistory()
    loadIncompleteSessions()
  }, [])

  const startNewGame = () => {
    const newSessionId = Date.now().toString()
    const startTime = new Date()

    setSessionId(newSessionId)
    setSessionName("")
    setSessionStartTime(startTime)
    setLastActionTimestamp(startTime)
    setIsGameActive(true)
    setRunningTotal(0)
    setCurrentNode("Start")
    setCurrentPath(["Start"])
    setPathValues([
      {
        node: "Start",
        value: calculateValue(decisionTree["Start"].value, initialAmount),
        action: "start",
        timestamp: startTime,
        note: "",
      },
    ])
  }

  const handleMoveChoice = (choice: "win" | "loss") => {
    setPendingChoice(choice)
    setShowConfirmDialog(true)
  }

  const confirmMove = async () => {
    if (!pendingChoice) return

    const nextNode = pendingChoice === "win" ? node.win : node.loss
    if (!nextNode) return

    const moveTimestamp = new Date()
    setLastActionTimestamp(moveTimestamp)

    // Update running total
    const newRunningTotal = pendingChoice === "win" ? runningTotal + currentStake : runningTotal - currentStake

    setRunningTotal(newRunningTotal)

    // Calculate next stake
    const nextStake = calculateValue(decisionTree[nextNode].value, initialAmount)

    // Update path values - fix the stake result to be negative for losses
    const newPathValue: PathValue = {
      node: nextNode,
      value: nextStake,
      action: pendingChoice,
      stakeResult: pendingChoice === "win" ? currentStake : -currentStake, // Make losses negative
      timestamp: moveTimestamp,
      note: "",
    }

    setPathValues((prev) => [...prev, newPathValue])
    setCurrentNode(nextNode)
    setCurrentPath((prev) => [...prev, nextNode])

    // Close dialog and reset
    setShowConfirmDialog(false)
    setPendingChoice(null)
  }

  const cancelMove = () => {
    setShowConfirmDialog(false)
    setPendingChoice(null)
  }

  const saveProgress = async () => {
    if (!sessionStartTime || !lastActionTimestamp) {
      alert("Session not started properly")
      return
    }

    setIsLoading(true)
    try {
      console.log("Preparing session data for save...")

      const sessionData: SessionData = {
        sessionId,
        sessionName,
        timestamp: formatDateTime(new Date()),
        result: "",
        initialAmount,
        finalTotal: runningTotal,
        sessionNotes: "",
        duration: calculateDuration(sessionStartTime, new Date()),
        isCompleted: false,
        currentNode,
        pathSummary: currentPath.join(" → "),
        sessionStartTime,
        lastActionTimestamp,
        pathValues,
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      })

      const result = await response.json()

      if (result.success) {
        alert("Progress saved successfully!")
        loadIncompleteSessions()
      } else {
        throw new Error(result.error || "Unknown error from server")
      }
    } catch (error) {
      console.error("Error saving progress:", error)
      alert(`Error saving progress: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const saveCompletedSession = async () => {
    if (!sessionStartTime || !lastActionTimestamp) {
      alert("Session not started properly")
      return
    }

    setIsLoading(true)
    try {
      console.log("Saving completed session...")

      const endTime = new Date()
      const finalTotal = node.final
        ? currentNode === "WIN"
          ? initialAmount + calculateValue(node.value, initialAmount)
          : initialAmount - Math.abs(calculateValue(node.value, initialAmount))
        : runningTotal

      const sessionData: SessionData = {
        sessionId,
        sessionName,
        timestamp: formatDateTime(endTime),
        result: currentNode,
        initialAmount,
        finalTotal,
        sessionNotes,
        duration: calculateDuration(sessionStartTime, endTime),
        isCompleted: true,
        currentNode,
        pathSummary: currentPath.join(" → "),
        sessionStartTime,
        lastActionTimestamp,
        pathValues,
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      })

      const result = await response.json()

      if (result.success) {
        alert("Session saved successfully!")
        loadSessionHistory()
        resetSession()
      } else {
        throw new Error(result.error || "Unknown error from server")
      }
    } catch (error) {
      console.error("Error saving session:", error)
      alert(`Error saving session: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSessionHistory = async () => {
    try {
      const params = new URLSearchParams({
        includeIncomplete: "false",
        limit: "50",
      })

      if (searchTerm) params.append("search", searchTerm)
      if (dateFrom) params.append("dateFrom", dateFrom)
      if (dateTo) params.append("dateTo", dateTo)
      if (resultFilter !== "all") params.append("result", resultFilter)

      const response = await fetch(`/api/sessions?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setSessionHistory(data.data || [])
      } else {
        console.warn("Session history load failed:", data.error)
        setSessionHistory([])
      }
    } catch (error) {
      console.error("Error loading session history:", error)
      setSessionHistory([])
    }
  }

  const loadIncompleteSessions = async () => {
    try {
      const response = await fetch("/api/sessions?includeIncomplete=true")
      const data = await response.json()

      if (data.success) {
        const incomplete = (data.data || []).filter((s: any) => !s.is_completed)
        setIncompleteSessions(incomplete)
      } else {
        console.warn("Incomplete sessions load failed:", data.error)
        setIncompleteSessions([])
      }
    } catch (error) {
      console.error("Error loading incomplete sessions:", error)
      setIncompleteSessions([])
    }
  }

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      const result = await response.json()

      if (result.success && result.data) {
        setSessionDetails((prev) => ({
          ...prev,
          [sessionId]: result.data,
        }))
      }
    } catch (error) {
      console.error("Error loading session details:", error)
    }
  }

  const toggleSessionExpansion = async (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)

    if (expandedSessions.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
      // Load details if not already loaded
      if (!sessionDetails[sessionId]) {
        await loadSessionDetails(sessionId)
      }
    }

    setExpandedSessions(newExpanded)
  }

  const resumeSession = async (session: any) => {
    try {
      // Get detailed session data including steps
      const response = await fetch(`/api/sessions/${session.session_id}`)
      const result = await response.json()

      if (result.success && result.data) {
        const sessionData = result.data

        // Restore session state
        setSessionId(sessionData.session_id)
        setSessionName(sessionData.session_name || "")
        setInitialAmount(sessionData.initial_amount)
        setRunningTotal(sessionData.final_total)
        setCurrentNode(sessionData.current_node)
        setSessionStartTime(new Date(sessionData.session_start_time))
        setLastActionTimestamp(new Date(sessionData.last_action_timestamp))
        setCurrentPath(sessionData.path_summary.split(" → "))

        // Reconstruct path values from session steps
        const steps = sessionData.steps || []
        const reconstructedPathValues: PathValue[] = steps.map((step: any) => ({
          node: step.node_name,
          value: step.stake_value,
          action: step.action,
          stakeResult: step.stake_result,
          timestamp: new Date(step.step_timestamp),
          note: step.note || "",
        }))

        setPathValues(reconstructedPathValues)
        setIsGameActive(true)

        alert("Session resumed successfully!")
      } else {
        alert("Failed to resume session")
      }
    } catch (error) {
      console.error("Error resuming session:", error)
      alert("Error resuming session")
    }
  }

  const handleDeleteSession = (sessionId: string, isCompleted = true) => {
    setSessionToDelete(sessionId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return

    try {
      const response = await fetch(`/api/sessions/${sessionToDelete}`, {
        method: "DELETE",
      })

      if (response.ok) {
        alert("Session deleted successfully!")
        loadIncompleteSessions()
        loadSessionHistory()
        // Remove from expanded sessions and details
        setExpandedSessions((prev) => {
          const newSet = new Set(prev)
          newSet.delete(sessionToDelete)
          return newSet
        })
        setSessionDetails((prev) => {
          const newDetails = { ...prev }
          delete newDetails[sessionToDelete]
          return newDetails
        })
      } else {
        alert("Failed to delete session")
      }
    } catch (error) {
      console.error("Error deleting session:", error)
      alert("Error deleting session")
    } finally {
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
    }
  }

  const cancelDeleteSession = () => {
    setShowDeleteConfirm(false)
    setSessionToDelete(null)
  }

  const resetSession = () => {
    setCurrentNode("Start")
    setCurrentPath(["Start"])
    setRunningTotal(0)
    setPathValues([])
    setSessionId("")
    setSessionName("")
    setSessionStartTime(null)
    setLastActionTimestamp(null)
    setIsGameActive(false)
    setSessionNotes("")
    setEditingNoteIndex(null)
    setTempNote("")
  }

  const startEditingNote = (index: number) => {
    setEditingNoteIndex(index)
    setTempNote(pathValues[index].note)
  }

  const saveNote = (index: number) => {
    setPathValues((prev) => prev.map((pv, i) => (i === index ? { ...pv, note: tempNote.trim() } : pv)))
    setEditingNoteIndex(null)
    setTempNote("")
  }

  const cancelEditingNote = () => {
    setEditingNoteIndex(null)
    setTempNote("")
  }

  const startEditingSessionName = (sessionId: string, currentName: string) => {
    setEditingSessionName(sessionId)
    setTempSessionName(currentName || "")
  }

  const saveSessionName = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionName: tempSessionName.trim() }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        loadSessionHistory()
        loadIncompleteSessions()
        setEditingSessionName(null)
        setTempSessionName("")
      } else {
        if (result.error && result.error.includes("migration")) {
          setHasSessionNameFeature(false)
          alert("Session naming feature requires database migration. Please run the migration script first.")
        } else {
          alert("Failed to update session name")
        }
      }
    } catch (error) {
      console.error("Error updating session name:", error)
      alert("Error updating session name")
    }
  }

  const cancelEditingSessionName = () => {
    setEditingSessionName(null)
    setTempSessionName("")
  }

  const applyFilters = () => {
    console.log("Applying filters:", { searchTerm, dateFrom, dateTo, resultFilter })
    loadSessionHistory()
  }

  const clearFilters = () => {
    setSearchTerm("")
    setDateFrom("")
    setDateTo("")
    setResultFilter("all")
    // Reload without filters
    setTimeout(() => loadSessionHistory(), 100)
  }

  const downloadExcel = async () => {
    try {
      // Load detailed data for all sessions
      const sessionsWithDetails = await Promise.all(
        sessionHistory.map(async (session) => {
          try {
            const response = await fetch(`/api/sessions/${session.session_id}`)
            const result = await response.json()
            return result.success ? { ...session, steps: result.data.steps || [] } : session
          } catch {
            return session
          }
        }),
      )

      // Create Excel-compatible XML content
      const createExcelXML = (data: any[]) => {
        let xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
 <Style ss:ID="Header">
  <Font ss:Bold="1"/>
  <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  <Font ss:Color="#FFFFFF"/>
 </Style>
 <Style ss:ID="WinCell">
  <Interior ss:Color="#70AD47" ss:Pattern="Solid"/>
  <Font ss:Color="#FFFFFF" ss:Bold="1"/>
 </Style>
 <Style ss:ID="LossCell">
  <Interior ss:Color="#E74C3C" ss:Pattern="Solid"/>
  <Font ss:Color="#FFFFFF" ss:Bold="1"/>
 </Style>
 <Style ss:ID="Currency">
  <NumberFormat ss:Format="$#,##0"/>
 </Style>
</Styles>
<Worksheet ss:Name="Session Summary">
<Table>
<Row>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Session Name</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Result</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Initial Amount</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Final Total</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Profit/Loss</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Duration</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Path</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Session Notes</Data></Cell>
</Row>`

        data.forEach((session) => {
          const profitLoss = session.final_total - session.initial_amount
          const resultStyle = session.result === "WIN" ? "WinCell" : "LossCell"

          xml += `
<Row>
 <Cell><Data ss:Type="String">${session.session_name || "Unnamed Session"}</Data></Cell>
 <Cell><Data ss:Type="String">${session.timestamp}</Data></Cell>
 <Cell ss:StyleID="${resultStyle}"><Data ss:Type="String">${session.result}</Data></Cell>
 <Cell ss:StyleID="Currency"><Data ss:Type="Number">${session.initial_amount}</Data></Cell>
 <Cell ss:StyleID="Currency"><Data ss:Type="Number">${session.final_total}</Data></Cell>
 <Cell ss:StyleID="Currency"><Data ss:Type="Number">${profitLoss}</Data></Cell>
 <Cell><Data ss:Type="String">${session.duration || ""}</Data></Cell>
 <Cell><Data ss:Type="String">${session.path_summary}</Data></Cell>
 <Cell><Data ss:Type="String">${(session.session_notes || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>
</Row>`
        })

        xml += `
</Table>
</Worksheet>
<Worksheet ss:Name="Detailed Steps">
<Table>
<Row>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Session Name</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Step Number</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Node</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Action</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Stake Value</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Stake Result</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Timestamp</Data></Cell>
 <Cell ss:StyleID="Header"><Data ss:Type="String">Step Notes</Data></Cell>
</Row>`

        data.forEach((session) => {
          if (session.steps && session.steps.length > 0) {
            session.steps.forEach((step: any, index: number) => {
              const actionStyle = step.action === "win" ? "WinCell" : step.action === "loss" ? "LossCell" : ""

              xml += `
<Row>
 <Cell><Data ss:Type="String">${session.session_name || "Unnamed Session"}</Data></Cell>
 <Cell><Data ss:Type="Number">${step.step_number || index + 1}</Data></Cell>
 <Cell><Data ss:Type="String">${step.node_name}</Data></Cell>
 <Cell ss:StyleID="${actionStyle}"><Data ss:Type="String">${step.action.toUpperCase()}</Data></Cell>
 <Cell ss:StyleID="Currency"><Data ss:Type="Number">${step.stake_value}</Data></Cell>
 <Cell ss:StyleID="Currency"><Data ss:Type="Number">${step.stake_result || 0}</Data></Cell>
 <Cell><Data ss:Type="String">${formatDateTime(new Date(step.step_timestamp))}</Data></Cell>
 <Cell><Data ss:Type="String">${(step.note || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>
</Row>`
            })
          }
        })

        xml += `
</Table>
</Worksheet>
</Workbook>`
        return xml
      }

      const excelContent = createExcelXML(sessionsWithDetails)

      // Create and download file
      const blob = new Blob([excelContent], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `decision-tree-sessions-${new Date().toISOString().split("T")[0]}.xls`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading Excel file:", error)
      alert("Error downloading file")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Decision Tree Tracker
            </h1>
          </div>
        </div>

        {/* Migration Notice */}
        {!hasSessionNameFeature && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Session Naming Feature:</strong> To enable session naming and advanced search features, please run
              the database migration script:{" "}
              <code className="bg-amber-100 px-1 rounded">scripts/002-add-session-name.sql</code>
            </AlertDescription>
          </Alert>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Confirm Your Choice
              </DialogTitle>
              <DialogDescription className="text-base">
                Are you sure you want to choose{" "}
                <span className={`font-bold ${pendingChoice === "win" ? "text-green-600" : "text-red-600"}`}>
                  {pendingChoice?.toUpperCase()}
                </span>
                ?
                <br />
                <br />
                This will {pendingChoice === "win" ? "add" : "subtract"}{" "}
                <span className="font-bold text-lg">{formatCurrency(currentStake)}</span>{" "}
                {pendingChoice === "win" ? "to" : "from"} your running total.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={cancelMove}>
                Go Back
              </Button>
              <Button
                onClick={confirmMove}
                className={
                  pendingChoice === "win"
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }
              >
                Confirm {pendingChoice?.toUpperCase()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Session
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this session? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDeleteSession}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteSession}>
                Delete Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!isGameActive ? (
          <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Play className="w-6 h-6 text-blue-600" />
                Session Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 items-center justify-center flex-wrap mb-8">
                <div className="flex gap-3 items-center bg-slate-50 rounded-lg p-4">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <label className="text-lg font-medium">Initial Amount:</label>
                  <Input
                    type="number"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(Number.parseInt(e.target.value) || 100000)}
                    className="w-40 text-lg font-semibold"
                    placeholder="100000"
                  />
                </div>
                <Button onClick={startNewGame} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
                  <Play className="w-5 h-5 mr-2" />
                  Start New Session
                </Button>
              </div>

              {incompleteSessions.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    Incomplete Sessions
                  </h3>
                  <div className="grid gap-4">
                    {incompleteSessions.map((session) => (
                      <Card
                        key={session.session_id}
                        className="border-l-4 border-l-amber-400 hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {editingSessionName === session.session_id && hasSessionNameFeature ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={tempSessionName}
                                      onChange={(e) => setTempSessionName(e.target.value)}
                                      placeholder="Enter session name..."
                                      className="h-8 text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => saveSessionName(session.session_id)}
                                      className="h-8 px-3"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEditingSessionName}
                                      className="h-8 px-3"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-lg">
                                      {session.session_name || "Unnamed Session"}
                                    </h4>
                                    {hasSessionNameFeature && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          startEditingSessionName(session.session_id, session.session_name)
                                        }
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Current Position:</span>
                                  <span className="ml-2 font-medium">{session.current_node}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Running Total:</span>
                                  <span
                                    className={`ml-2 font-semibold ${session.final_total >= 0 ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {formatCurrency(session.final_total)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">{session.timestamp}</div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => resumeSession(session)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Resume
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteSession(session.session_id, false)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Current State */}
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold mb-4 flex items-center justify-center gap-2">
                    <Target className="w-6 h-6 text-blue-600" />
                    Current Position
                  </h2>
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-6 mb-6">
                    <div className="text-4xl font-bold mb-2">
                      {currentNode}: {node.value}
                    </div>
                    <div className="text-lg opacity-90">Level {node.level}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-2 border-blue-100">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-muted-foreground mb-1">Current Stake</div>
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(currentStake)}</div>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-slate-100">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-muted-foreground mb-1">Running Total</div>
                        <div
                          className={`text-2xl font-bold ${
                            runningTotal > 0 ? "text-green-600" : runningTotal < 0 ? "text-red-600" : "text-gray-600"
                          }`}
                        >
                          {formatCurrency(runningTotal)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-slate-100">
                      <CardContent className="p-4 text-center">
                        <div className="text-sm text-muted-foreground mb-1">Last Action</div>
                        <div className="text-sm font-medium">
                          {lastActionTimestamp ? formatDateTime(lastActionTimestamp) : "-"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground bg-slate-100 px-3 py-1 rounded-full">
                      Level {node.level === "END" ? "Complete" : `${node.level}/10`}
                    </span>
                  </div>
                  <Progress value={progress} className="h-3 bg-slate-200" />
                </div>

                {/* Enhanced Action Buttons */}
                {!node.final && (
                  <div className="flex gap-8 justify-center mb-8">
                    <Button
                      onClick={() => handleMoveChoice("win")}
                      size="lg"
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex flex-col items-center px-16 py-10 text-xl font-bold rounded-2xl"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <TrendingUp className="w-8 h-8" />
                        <span>WIN (1)</span>
                      </div>
                      <span className="text-lg font-normal opacity-90">+{formatCurrency(currentStake)}</span>
                    </Button>
                    <Button
                      onClick={() => handleMoveChoice("loss")}
                      size="lg"
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex flex-col items-center px-16 py-10 text-xl font-bold rounded-2xl"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <TrendingDown className="w-8 h-8" />
                        <span>LOSS (0)</span>
                      </div>
                      <span className="text-lg font-normal opacity-90">-{formatCurrency(currentStake)}</span>
                    </Button>
                  </div>
                )}

                {/* Session Name and Save Progress */}
                {!node.final && (
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {hasSessionNameFeature && (
                      <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                        <label className="text-sm font-medium whitespace-nowrap">Session Name:</label>
                        <Input
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder="Enter a name for this session..."
                          className="w-64"
                        />
                      </div>
                    )}
                    <Button
                      onClick={saveProgress}
                      disabled={isLoading}
                      variant="outline"
                      size="lg"
                      className="flex items-center gap-2 border-2 hover:bg-blue-50"
                    >
                      <Save className="w-5 h-5" />
                      Save Progress
                    </Button>
                  </div>
                )}

                {/* Final Result */}
                {node.final && (
                  <div
                    className={`rounded-2xl p-8 text-center shadow-2xl ${
                      currentNode === "WIN"
                        ? "bg-gradient-to-r from-green-500 to-green-600"
                        : "bg-gradient-to-r from-red-500 to-red-600"
                    } text-white`}
                  >
                    <h2 className="text-3xl font-bold mb-4">🎯 Final Result</h2>
                    <div className="text-5xl font-bold mb-4">
                      {currentNode}: {node.value}
                    </div>
                    <div className="text-3xl font-bold mb-6">
                      Final Total:{" "}
                      {formatCurrency(
                        currentNode === "WIN"
                          ? calculateValue(node.value, initialAmount)
                          : -Math.abs(calculateValue(node.value, initialAmount)),
                      )}
                    </div>

                    <div className="bg-white bg-opacity-20 rounded-xl p-6 mb-6">
                      <label className="block text-lg font-medium mb-3">Add a note about this session:</label>
                      <Textarea
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder="Enter your notes about this trading session..."
                        className="bg-white text-black text-base"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-4 justify-center">
                      <Button
                        onClick={saveCompletedSession}
                        disabled={isLoading}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        Save Session
                      </Button>
                      <Button
                        onClick={resetSession}
                        variant="outline"
                        size="lg"
                        className="text-black hover:text-black bg-white hover:bg-gray-100 px-8 py-3"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start New Session
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Path Tracker */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Current Path & Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {pathValues.map((item, index) => {
                      const isLast = index === pathValues.length - 1
                      const timeText = formatDateTime(item.timestamp)
                      const isEditing = editingNoteIndex === index

                      return (
                        <Card
                          key={index}
                          className={`${isLast ? "border-2 border-blue-200 bg-blue-50" : "border border-slate-200"}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="font-semibold text-lg">{item.node}</span>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {timeText}
                                </div>
                              </div>
                              <div className="text-right">
                                {item.action === "start" ? (
                                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
                                    Stake: {formatCurrency(item.value)}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div
                                      className={`px-3 py-1 rounded-lg font-semibold ${
                                        item.action === "win"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {item.stakeResult && item.stakeResult > 0 ? "+" : ""}
                                      {formatCurrency(item.stakeResult || 0)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      → Stake: {formatCurrency(item.value)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Note Display/Edit */}
                            <div className="mt-3">
                              {item.note && !isEditing && (
                                <div className="flex items-start gap-2">
                                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm p-3 flex-1">
                                    {item.note}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingNote(index)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}

                              {isEditing && (
                                <div className="space-y-3">
                                  <Textarea
                                    value={tempNote}
                                    onChange={(e) => setTempNote(e.target.value)}
                                    placeholder="Add a note about this step..."
                                    className="text-black bg-white"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => saveNote(index)}
                                      className="flex items-center gap-1"
                                    >
                                      <Check className="w-4 h-4" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEditingNote}>
                                      <X className="w-4 h-4" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {!item.note && !isEditing && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingNote(index)}
                                  className="mt-1"
                                >
                                  Add Note
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Reset Button */}
            <div className="text-center">
              <Button onClick={resetSession} variant="outline" size="lg" className="flex items-center gap-2 border-2">
                <RotateCcw className="w-5 h-5" />
                Reset Current Session
              </Button>
            </div>
          </div>
        )}

        {/* Session History with Search and Filters */}
        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                Session History
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={downloadExcel}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200"
                  disabled={sessionHistory.length === 0}
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </Button>
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </Button>
                <Button onClick={loadSessionHistory} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            {showFilters && (
              <Card className="mb-6 border-slate-200">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={hasSessionNameFeature ? "Search by name or notes..." : "Search by notes..."}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">From Date</label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">To Date</label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Result</label>
                      <Select value={resultFilter} onValueChange={setResultFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Results</SelectItem>
                          <SelectItem value="win">Win Only</SelectItem>
                          <SelectItem value="lost">Loss Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={applyFilters} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                      Apply Filters
                    </Button>
                    <Button onClick={clearFilters} variant="outline" size="sm">
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {(searchTerm || dateFrom || dateTo || resultFilter !== "all") && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800 font-medium">
                  Active filters: {searchTerm && `Search: "${searchTerm}"`} {dateFrom && `From: ${dateFrom}`}{" "}
                  {dateTo && `To: ${dateTo}`} {resultFilter !== "all" && `Result: ${resultFilter}`}
                </div>
              </div>
            )}

            <ScrollArea className="h-96">
              <div className="space-y-4">
                {sessionHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">No sessions found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters or create a new session</p>
                  </div>
                ) : (
                  sessionHistory.map((session) => (
                    <Card key={session.session_id} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={session.result === "WIN" ? "default" : "destructive"}
                              className={`text-sm px-3 py-1 ${
                                session.result === "WIN"
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "bg-red-600 hover:bg-red-700 text-white"
                              }`}
                            >
                              {session.result}
                            </Badge>
                            {editingSessionName === session.session_id && hasSessionNameFeature ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={tempSessionName}
                                  onChange={(e) => setTempSessionName(e.target.value)}
                                  placeholder="Enter session name..."
                                  className="h-8 text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => saveSessionName(session.session_id)}
                                  className="h-8 px-3"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditingSessionName}
                                  className="h-8 px-3"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">
                                  {session.session_name || "Unnamed Session"}
                                </span>
                                {hasSessionNameFeature && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingSessionName(session.session_id, session.session_name)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{session.timestamp}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleSessionExpansion(session.session_id)}
                              className="h-8 w-8 p-0"
                            >
                              {expandedSessions.has(session.session_id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSession(session.session_id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Initial:</span>
                            <span className="ml-2 font-medium">{formatCurrency(session.initial_amount)}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Final:</span>
                            <span
                              className={`ml-2 font-semibold ${session.final_total >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {formatCurrency(session.final_total)}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground mb-2">
                          <strong>Path:</strong> {session.path_summary}
                        </div>
                        {session.duration && (
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Duration: {session.duration}
                          </div>
                        )}
                        {session.session_notes && (
                          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm">
                            <strong>Notes:</strong> {session.session_notes}
                          </div>
                        )}

                        {/* Expanded Details */}
                        {expandedSessions.has(session.session_id) && sessionDetails[session.session_id] && (
                          <>
                            <Separator className="my-4" />
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Step Details:
                              </h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {sessionDetails[session.session_id].steps?.map((step: any, index: number) => (
                                  <Card key={index} className="border-slate-200">
                                    <CardContent className="p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="font-medium">{step.node_name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatDateTime(new Date(step.step_timestamp))}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center mb-2">
                                        <Badge
                                          variant={
                                            step.action === "win"
                                              ? "default"
                                              : step.action === "loss"
                                                ? "destructive"
                                                : "secondary"
                                          }
                                          className={`text-xs ${
                                            step.action === "win"
                                              ? "bg-green-600 hover:bg-green-700 text-white"
                                              : step.action === "loss"
                                                ? "bg-red-600 hover:bg-red-700 text-white"
                                                : ""
                                          }`}
                                        >
                                          {step.action.toUpperCase()}
                                        </Badge>
                                        <div className="text-xs">
                                          <span>Stake: {formatCurrency(step.stake_value)}</span>
                                          {step.stake_result && (
                                            <span className={step.action === "win" ? "text-green-600" : "text-red-600"}>
                                              {" "}
                                              ({step.action === "win" ? "+" : "-"}
                                              {formatCurrency(Math.abs(step.stake_result))})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {step.note && (
                                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-2 rounded text-xs">
                                          <strong>Note:</strong> {step.note}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
