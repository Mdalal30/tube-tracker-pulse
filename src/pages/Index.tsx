import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Train, BarChart3, MapPin, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-secondary">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-block bg-white rounded-full p-6 mb-6">
            <Train className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            London Underground Analytics
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Production-ready journey tracking and analytics platform for Transport for London
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="bg-white text-primary hover:bg-white/90">
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
            <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <Train className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Journey Tracking</h3>
            <p className="text-white/80">
              Real-time check-in and check-out system for accurate journey capture
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
            <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Advanced Analytics</h3>
            <p className="text-white/80">
              Comprehensive insights into journey patterns, peak times, and trends
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
            <div className="bg-white/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Role-Based Access</h3>
            <p className="text-white/80">
              Secure admin and analyst roles for data management and reporting
            </p>
          </div>
        </div>

        <div className="mt-16 text-center text-white/80">
          <p className="mb-4">Features include:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "PostgreSQL Database",
              "Real-time Updates",
              "Secure Authentication",
              "Data Export",
              "Station Management",
              "User Roles",
            ].map((feature) => (
              <span key={feature} className="bg-white/20 px-4 py-2 rounded-full text-sm">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
