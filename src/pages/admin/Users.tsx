import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
}

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndRole();
    fetchUsers();
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

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "You must be an admin to manage users",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          return {
            ...profile,
            roles: roles?.map(r => r.role) || [],
          };
        })
      );

      setUsers(usersWithRoles);
    }

    setLoading(false);
  };

  const handleRoleChange = async (userId: string, role: "admin" | "analyst" | "user", action: "add" | "remove") => {
    setLoading(true);

    if (action === "add") {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: role as any });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${role} role added successfully`,
        });
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${role} role removed successfully`,
        });
      }
    }

    fetchUsers();
    setLoading(false);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "analyst":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>{users.length} registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading && users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="bg-primary text-primary-foreground rounded-full p-2">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                          
                          <div className="flex gap-2 mt-2">
                            {user.roles.length === 0 ? (
                              <Badge variant="outline">User</Badge>
                            ) : (
                              user.roles.map((role) => (
                                <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                  {role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Select
                          onValueChange={(value) => {
                            const [action, role] = value.split(":");
                            handleRoleChange(user.id, role, action as "add" | "remove");
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Manage roles" />
                          </SelectTrigger>
                          <SelectContent>
                            {!user.roles.includes("admin") && (
                              <SelectItem value="add:admin">
                                <Shield className="inline h-3 w-3 mr-2" />
                                Add Admin
                              </SelectItem>
                            )}
                            {user.roles.includes("admin") && (
                              <SelectItem value="remove:admin">Remove Admin</SelectItem>
                            )}
                            {!user.roles.includes("analyst") && (
                              <SelectItem value="add:analyst">Add Analyst</SelectItem>
                            )}
                            {user.roles.includes("analyst") && (
                              <SelectItem value="remove:analyst">Remove Analyst</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Users;
