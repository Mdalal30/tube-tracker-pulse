import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Station {
  id: string;
  name: string;
  zone: number;
  line: {
    name: string;
    color: string;
  };
}

interface Journey {
  id: string;
  entry_station: Station;
  exit_station?: Station;
  entry_time: string;
  exit_time?: string;
  status: string;
  fare?: number;
}

const Journeys = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [journeyHistory, setJourneyHistory] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchStations();
    fetchJourneys();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchStations = async () => {
    const { data, error } = await supabase
      .from("stations")
      .select(`
        id,
        name,
        zone,
        line:lines(name, color)
      `)
      .order("name");

    if (error) {
      console.error("Error fetching stations:", error);
    } else {
      setStations(data as any);
    }
  };

  const fetchJourneys = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("journeys")
      .select(`
        id,
        entry_time,
        exit_time,
        status,
        fare,
        entry_station:stations!journeys_entry_station_id_fkey(
          id, name, zone,
          line:lines(name, color)
        ),
        exit_station:stations!journeys_exit_station_id_fkey(
          id, name, zone,
          line:lines(name, color)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching journeys:", error);
    } else {
      const active = data.find((j: any) => j.status === "in_progress");
      setActiveJourney(active || null);
      setJourneyHistory(data.filter((j: any) => j.status === "completed"));
    }
  };

  const handleCheckIn = async () => {
    if (!selectedStation) {
      toast({
        title: "Error",
        description: "Please select a station",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("journeys").insert({
      user_id: user.id,
      entry_station_id: selectedStation,
      status: "in_progress",
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Checked In",
        description: "Journey started successfully",
      });
      setSelectedStation("");
      fetchJourneys();
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!selectedStation || !activeJourney) {
      toast({
        title: "Error",
        description: "Please select a station",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Calculate fare based on zones
    const entryZone = activeJourney.entry_station.zone;
    const exitZone = stations.find(s => s.id === selectedStation)?.zone || 1;
    const zoneDiff = Math.abs(entryZone - exitZone);
    const fare = 2.50 + (zoneDiff * 0.50);

    const { error } = await supabase
      .from("journeys")
      .update({
        exit_station_id: selectedStation,
        exit_time: new Date().toISOString(),
        status: "completed",
        fare: fare,
      })
      .eq("id", activeJourney.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Checked Out",
        description: `Journey completed. Fare: £${fare.toFixed(2)}`,
      });
      setSelectedStation("");
      fetchJourneys();
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Journey Tracking</h1>
          <p className="text-muted-foreground">Check in and out of stations</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{activeJourney ? "Check Out" : "Check In"}</CardTitle>
              <CardDescription>
                {activeJourney 
                  ? `Currently at ${activeJourney.entry_station.name}` 
                  : "Start a new journey"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Station</label>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: station.line.color }}
                          />
                          {station.name} (Zone {station.zone})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeJourney ? (
                <div className="space-y-2">
                  <div className="p-3 bg-accent rounded-lg">
                    <p className="text-sm font-medium">Active Journey</p>
                    <p className="text-sm text-muted-foreground">
                      From: {activeJourney.entry_station.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started: {new Date(activeJourney.entry_time).toLocaleString()}
                    </p>
                  </div>
                  <Button onClick={handleCheckOut} className="w-full" disabled={loading || !selectedStation}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Check Out
                  </Button>
                </div>
              ) : (
                <Button onClick={handleCheckIn} className="w-full" disabled={loading || !selectedStation}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Check In
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journey History</CardTitle>
              <CardDescription>Your completed journeys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {journeyHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed journeys yet</p>
                ) : (
                  journeyHistory.map((journey) => (
                    <div key={journey.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {journey.entry_station.name} → {journey.exit_station?.name}
                          </span>
                        </div>
                        {journey.fare && (
                          <Badge variant="secondary">£{journey.fare.toFixed(2)}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(journey.entry_time).toLocaleDateString()} at{" "}
                        {new Date(journey.entry_time).toLocaleTimeString()}
                      </p>
                      <div className="flex gap-2">
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: journey.entry_station.line.color }}
                        >
                          {journey.entry_station.line.name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Zone {journey.entry_station.zone} → Zone {journey.exit_station?.zone}
                        </Badge>
                      </div>
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

export default Journeys;
