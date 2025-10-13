-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create lines table
CREATE TABLE public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lines"
  ON public.lines FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage lines"
  ON public.lines FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create stations table
CREATE TABLE public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE,
  zone INTEGER NOT NULL CHECK (zone >= 1 AND zone <= 9),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stations"
  ON public.stations FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage stations"
  ON public.stations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create journeys table
CREATE TABLE public.journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_station_id UUID REFERENCES public.stations(id) NOT NULL,
  exit_station_id UUID REFERENCES public.stations(id),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  fare DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journeys"
  ON public.journeys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journeys"
  ON public.journeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journeys"
  ON public.journeys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and analysts can view all journeys"
  ON public.journeys FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'analyst')
  );

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample London Underground lines
INSERT INTO public.lines (name, color) VALUES
  ('Bakerloo', '#B36305'),
  ('Central', '#E32017'),
  ('Circle', '#FFD300'),
  ('District', '#00782A'),
  ('Hammersmith & City', '#F3A9BB'),
  ('Jubilee', '#A0A5A9'),
  ('Metropolitan', '#9B0056'),
  ('Northern', '#000000'),
  ('Piccadilly', '#003688'),
  ('Victoria', '#0098D4'),
  ('Waterloo & City', '#95CDBA'),
  ('Elizabeth', '#7156A5');

-- Insert sample stations
INSERT INTO public.stations (name, line_id, zone, latitude, longitude)
SELECT 
  station_name,
  l.id,
  station_zone,
  station_lat,
  station_lon
FROM (VALUES
  ('King''s Cross St. Pancras', 'Northern', 1, 51.5308, -0.1238),
  ('Oxford Circus', 'Central', 1, 51.5152, -0.1415),
  ('Piccadilly Circus', 'Piccadilly', 1, 51.5098, -0.1342),
  ('Liverpool Street', 'Central', 1, 51.5178, -0.0823),
  ('Victoria', 'Victoria', 1, 51.4952, -0.1441),
  ('Waterloo', 'Jubilee', 1, 51.5036, -0.1143),
  ('Leicester Square', 'Northern', 1, 51.5113, -0.1281),
  ('Green Park', 'Jubilee', 1, 51.5067, -0.1428),
  ('Bank', 'Central', 1, 51.5133, -0.0886),
  ('Westminster', 'District', 1, 51.5010, -0.1254),
  ('Canary Wharf', 'Jubilee', 2, 51.5054, -0.0195),
  ('Heathrow Terminal 5', 'Piccadilly', 6, 51.4714, -0.4881),
  ('Stratford', 'Central', 3, 51.5413, -0.0037),
  ('Wembley Park', 'Metropolitan', 4, 51.5635, -0.2795),
  ('Richmond', 'District', 4, 51.4613, -0.3009)
) AS stations(station_name, line_name, station_zone, station_lat, station_lon)
JOIN public.lines l ON l.name = stations.line_name;

-- Enable realtime for journeys
ALTER PUBLICATION supabase_realtime ADD TABLE public.journeys;