import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Train, TrendingUp, MapPin, Clock } from "lucide-react";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJourneys: 0,
    activeJourneys: 0,
    completedToday: 0,
    totalStations: 0,
  });
  const [journeysByLine, setJourneysByLine] = useState<any[]>([]);
  const [recentJourneys, setRecentJourneys] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchDashboardData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user has admin or analyst role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdminOrAnalyst = roles?.some(r => r.role === "admin" || r.role === "analyst");

      // Fetch journey stats
      let journeysQuery = supabase.from("journeys").select("*");
      
      if (!isAdminOrAnalyst) {
        journeysQuery = journeysQuery.eq("user_id", user.id);
      }

      const { data: journeys } = await journeysQuery;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setStats({
        totalJourneys: journeys?.length || 0,
        activeJourneys: journeys?.filter(j => j.status === "in_progress").length || 0,
        completedToday: journeys?.filter(j => {
          const journeyDate = new Date(j.created_at);
          return journeyDate >= today && j.status === "completed";
        }).length || 0,
        totalStations: 0,
      });

      // Fetch stations count
      const { count } = await supabase
        .from("stations")
        .select("*", { count: "exact", head: true });

      setStats(prev => ({ ...prev, totalStations: count || 0 }));

      // Fetch recent journeys with station details
      const { data: recentData } = await supabase
        .from("journeys")
        .select(`
          *,
          entry_station:stations!journeys_entry_station_id_fkey(name, zone),
          exit_station:stations!journeys_exit_station_id_fkey(name, zone)
        `)
        .eq(isAdminOrAnalyst ? "status" : "user_id", isAdminOrAnalyst ? "in_progress" : user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentJourneys(recentData || []);

      // Fetch journeys by line
      const { data: lineData } = await supabase
        .from("journeys")
        .select(`
          id,
          entry_station:stations!journeys_entry_station_id_fkey(
            line:lines(name, color)
          )
        `);

      const lineCounts: { [key: string]: { count: number; color: string } } = {};
      lineData?.forEach((journey: any) => {
        const lineName = journey.entry_station?.line?.name;
        const lineColor = journey.entry_station?.line?.color;
        if (lineName) {
          if (!lineCounts[lineName]) {
            lineCounts[lineName] = { count: 0, color: lineColor || "#000000" };
          }
          lineCounts[lineName].count++;
        }
      });

      const chartData = Object.entries(lineCounts).map(([name, data]) => ({
        name,
        value: data.count,
        color: data.color,
      }));

      setJourneysByLine(chartData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of journey analytics</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Journeys</CardTitle>
              <Train className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJourneys}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Journeys</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeJourneys}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedToday}</div>
              <p className="text-xs text-muted-foreground">Since midnight</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStations}</div>
              <p className="text-xs text-muted-foreground">Network wide</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Journeys by Line</CardTitle>
              <CardDescription>Distribution across Underground lines</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={journeysByLine}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {journeysByLine.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest journey updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentJourneys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent journeys</p>
                ) : (
                  recentJourneys.map((journey) => (
                    <div key={journey.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="text-sm font-medium">
                          {journey.entry_station?.name || "Unknown"}
                          {journey.exit_station ? ` → ${journey.exit_station.name}` : " (In progress)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(journey.entry_time).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        journey.status === "completed" 
                          ? "bg-accent text-accent-foreground" 
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {journey.status === "completed" ? "Completed" : "Active"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
