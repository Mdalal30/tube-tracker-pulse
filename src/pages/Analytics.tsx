import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Analytics = () => {
  const [journeysByHour, setJourneysByHour] = useState<any[]>([]);
  const [stationRankings, setStationRankings] = useState<any[]>([]);
  const [peakTimes, setPeakTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndRole();
    fetchAnalytics();
  }, []);

  const checkAuthAndRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAccess = roles?.some(r => r.role === "admin" || r.role === "analyst");
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to view analytics",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch all journeys with station details
      const { data: journeys } = await supabase
        .from("journeys")
        .select(`
          *,
          entry_station:stations!journeys_entry_station_id_fkey(id, name, zone),
          exit_station:stations!journeys_exit_station_id_fkey(id, name, zone)
        `)
        .eq("status", "completed");

      if (journeys) {
        // Journeys by hour of day
        const hourCounts: { [key: number]: number } = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;

        journeys.forEach((journey: any) => {
          const hour = new Date(journey.entry_time).getHours();
          hourCounts[hour]++;
        });

        const hourData = Object.entries(hourCounts).map(([hour, count]) => ({
          hour: `${hour}:00`,
          journeys: count,
        }));
        setJourneysByHour(hourData);

        // Station rankings (most used entry stations)
        const stationCounts: { [key: string]: { name: string; count: number; zone: number } } = {};
        
        journeys.forEach((journey: any) => {
          const stationId = journey.entry_station.id;
          if (!stationCounts[stationId]) {
            stationCounts[stationId] = {
              name: journey.entry_station.name,
              count: 0,
              zone: journey.entry_station.zone,
            };
          }
          stationCounts[stationId].count++;
        });

        const rankings = Object.values(stationCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map((station, index) => ({
            rank: index + 1,
            ...station,
          }));

        setStationRankings(rankings);

        // Peak times analysis
        const peakData = hourData
          .sort((a, b) => b.journeys - a.journeys)
          .slice(0, 5);
        setPeakTimes(peakData);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    const { data: journeys } = await supabase
      .from("journeys")
      .select(`
        *,
        entry_station:stations!journeys_entry_station_id_fkey(name, zone),
        exit_station:stations!journeys_exit_station_id_fkey(name, zone)
      `)
      .eq("status", "completed");

    if (journeys) {
      const csv = [
        ["Entry Station", "Exit Station", "Entry Time", "Exit Time", "Fare", "Entry Zone", "Exit Zone"].join(","),
        ...journeys.map((j: any) => [
          j.entry_station.name,
          j.exit_station?.name || "N/A",
          new Date(j.entry_time).toLocaleString(),
          j.exit_time ? new Date(j.exit_time).toLocaleString() : "N/A",
          j.fare || "N/A",
          j.entry_station.zone,
          j.exit_station?.zone || "N/A",
        ].join(","))
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tfl-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();

      toast({
        title: "Export Complete",
        description: "Analytics data exported successfully",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive journey insights and trends</p>
          </div>
          <Button onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Journeys by Hour of Day</CardTitle>
              <CardDescription>Journey distribution across 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={journeysByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="journeys" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Busiest Stations</CardTitle>
                <CardDescription>Most frequently used entry points</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stationRankings} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Times Analysis</CardTitle>
                <CardDescription>Highest traffic periods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {peakTimes.map((time, index) => (
                    <div key={time.hour} className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{time.hour}</p>
                          <p className="text-sm text-muted-foreground">Peak hour</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{time.journeys}</p>
                        <p className="text-xs text-muted-foreground">journeys</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Station Usage Details</CardTitle>
              <CardDescription>Detailed breakdown of station activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stationRankings.map((station) => (
                  <div key={station.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">#{station.rank}</span>
                      <div>
                        <p className="font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">Zone {station.zone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{station.count}</p>
                      <p className="text-xs text-muted-foreground">journeys</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
