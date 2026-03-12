import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const STORAGE_KEY = 'api_key'

// Типы для API ответов
interface ScoreBucket {
  bucket: string
  count: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface PassRateEntry {
  task: string
  avg_score: number
  attempts: number
}

interface ItemRecord {
  id: number
  type: string
  title: string
  parent_id: number | null
  description: string | null
  created_at: string
  updated_at: string
}

// Состояния загрузки
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function Dashboard() {
  const [token] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [labs, setLabs] = useState<ItemRecord[]>([])
  const [selectedLab, setSelectedLab] = useState<string>('')

  const [scoresState, setScoresState] = useState<FetchState<ScoreBucket[]>>({
    status: 'idle',
  })
  const [timelineState, setTimelineState] = useState<FetchState<TimelineEntry[]>>({
    status: 'idle',
  })
  const [passRatesState, setPassRatesState] = useState<FetchState<PassRateEntry[]>>({
    status: 'idle',
  })

  // Загрузка списка labs
  useEffect(() => {
    if (!token) return

    fetch('/items/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: ItemRecord[]) => {
        const labItems = data.filter((item) => item.type === 'lab')
        setLabs(labItems)
        if (labItems.length > 0 && !selectedLab) {
          // Выбираем первый lab по умолчанию
          const firstLabSlug = labItemToSlug(labItems[0])
          setSelectedLab(firstLabSlug)
        }
      })
      .catch((err: Error) => {
        console.error('Failed to fetch labs:', err)
      })
  }, [token])

  // Загрузка данных аналитики при изменении выбранного lab
  useEffect(() => {
    if (!token || !selectedLab) return

    const fetchScores = async () => {
      setScoresState({ status: 'loading' })
      try {
        const res = await fetch(
          `/analytics/scores?lab=${encodeURIComponent(selectedLab)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ScoreBucket[] = await res.json()
        setScoresState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setScoresState({ status: 'error', message })
      }
    }

    const fetchTimeline = async () => {
      setTimelineState({ status: 'loading' })
      try {
        const res = await fetch(
          `/analytics/timeline?lab=${encodeURIComponent(selectedLab)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: TimelineEntry[] = await res.json()
        setTimelineState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setTimelineState({ status: 'error', message })
      }
    }

    const fetchPassRates = async () => {
      setPassRatesState({ status: 'loading' })
      try {
        const res = await fetch(
          `/analytics/pass-rates?lab=${encodeURIComponent(selectedLab)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: PassRateEntry[] = await res.json()
        setPassRatesState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setPassRatesState({ status: 'error', message })
      }
    }

    fetchScores()
    fetchTimeline()
    fetchPassRates()
  }, [token, selectedLab])

  // Преобразование lab item в slug (lab-01, lab-04, и т.д.)
  function labItemToSlug(lab: ItemRecord): string {
    // title: "Lab 04 — Testing" → "lab-04"
    const match = lab.title.match(/Lab\s+(\d+)/i)
    if (match) {
      return `lab-${match[1].padStart(2, '0')}`
    }
    // Fallback: использовать id
    const idNum = lab.id.toString().padStart(2, '0')
    return `lab-${idNum}`
  }

  // Обработчик изменения lab в dropdown
  function handleLabChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedLab(e.target.value)
  }

  // Данные для bar chart (score buckets)
  const scoresChartData =
    scoresState.status === 'success'
      ? {
          labels: scoresState.data.map((d) => d.bucket),
          datasets: [
            {
              label: 'Количество студентов',
              data: scoresState.data.map((d) => d.count),
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1,
            },
          ],
        }
      : { labels: [], datasets: [] }

  // Данные для line chart (timeline)
  const timelineChartData =
    timelineState.status === 'success'
      ? {
          labels: timelineState.data.map((d) => d.date),
          datasets: [
            {
              label: 'Отправки',
              data: timelineState.data.map((d) => d.submissions),
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              tension: 0.1,
            },
          ],
        }
      : { labels: [], datasets: [] }

  if (!token) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Please enter your API key in the main app to view analytics.</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="lab-selector">
          <label htmlFor="lab-select">Select Lab: </label>
          <select
            id="lab-select"
            value={selectedLab}
            onChange={handleLabChange}
            disabled={labs.length === 0}
          >
            {labs.length === 0 && (
              <option value="">Loading labs...</option>
            )}
            {labs.map((lab) => {
              const slug = labItemToSlug(lab)
              return (
                <option key={lab.id} value={slug}>
                  {lab.title}
                </option>
              )
            })}
          </select>
        </div>
      </header>

      <section className="chart-section">
        <h2>Score Distribution</h2>
        {scoresState.status === 'loading' && <p>Loading...</p>}
        {scoresState.status === 'error' && (
          <p className="error">Error: {scoresState.message}</p>
        )}
        {scoresState.status === 'success' && (
          <Bar
            data={scoresChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title: { display: false },
              },
              scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
              },
            }}
          />
        )}
      </section>

      <section className="chart-section">
        <h2>Submissions Timeline</h2>
        {timelineState.status === 'loading' && <p>Loading...</p>}
        {timelineState.status === 'error' && (
          <p className="error">Error: {timelineState.message}</p>
        )}
        {timelineState.status === 'success' && (
          <Line
            data={timelineChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title: { display: false },
              },
              scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
              },
            }}
          />
        )}
      </section>

      <section className="table-section">
        <h2>Pass Rates per Task</h2>
        {passRatesState.status === 'loading' && <p>Loading...</p>}
        {passRatesState.status === 'error' && (
          <p className="error">Error: {passRatesState.message}</p>
        )}
        {passRatesState.status === 'success' && (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Avg Score</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {passRatesState.data.length === 0 ? (
                <tr>
                  <td colSpan={3}>No data available</td>
                </tr>
              ) : (
                passRatesState.data.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.task}</td>
                    <td>{entry.avg_score}</td>
                    <td>{entry.attempts}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default Dashboard
