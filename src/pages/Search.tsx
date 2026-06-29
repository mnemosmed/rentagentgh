import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { AreaSearch, AreaSearchRef } from '@/components/AreaSearch';
import { AgentCard } from '@/components/AgentCard';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents, useAllAreas } from '@/hooks/useAgents';
import { useContactedAgents } from '@/hooks/useContactedAgents';
import { Search, MapPin, Users, Loader2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const areaFromUrl = searchParams.get('area') || '';
  
  const [searchValue, setSearchValue] = useState(areaFromUrl);
  const [selectedArea, setSelectedArea] = useState<string | null>(areaFromUrl || null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<string | null>(() => {
    return sessionStorage.getItem('pendingSearch');
  });
  const areaSearchRef = useRef<AreaSearchRef>(null);
  
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: agents = [], isLoading: agentsLoading } = useAgents();
  const { data: allAreas = [] } = useAllAreas();
  const { data: contactedAgentIds = [] } = useContactedAgents();

  // Store pending search in sessionStorage when it changes
  useEffect(() => {
    if (pendingSearch) {
      sessionStorage.setItem('pendingSearch', pendingSearch);
    } else {
      sessionStorage.removeItem('pendingSearch');
    }
  }, [pendingSearch]);

  // Sync selectedArea with URL params when component mounts or URL changes
  useEffect(() => {
    if (!authLoading && isAuthenticated && areaFromUrl) {
      setSelectedArea(areaFromUrl);
      setSearchValue(areaFromUrl);
    }
  }, [authLoading]);
  
  // Also handle when areaFromUrl changes (e.g., navigating back)
  useEffect(() => {
    if (areaFromUrl && isAuthenticated) {
      setSelectedArea(areaFromUrl);
      setSearchValue(areaFromUrl);
    }
  }, [areaFromUrl]);

  useEffect(() => {
    // If user just authenticated and has a pending search, execute it
    if (isAuthenticated && !authLoading && pendingSearch) {
      setSelectedArea(pendingSearch);
      setSearchValue(pendingSearch);
      setSearchParams({ area: pendingSearch });
      setPendingSearch(null);
      return;
    }
    
    // If user arrives with an area param but is not authenticated, show auth modal
    if (areaFromUrl && !isAuthenticated && !authLoading) {
      setPendingSearch(areaFromUrl);
      setShowAuthModal(true);
    }
  }, [isAuthenticated, authLoading, pendingSearch, areaFromUrl]);

  const handleSearch = () => {
    if (!searchValue) return;
    
    // Close the dropdown
    areaSearchRef.current?.closeDropdown();
    
    if (!isAuthenticated) {
      setPendingSearch(searchValue);
      setShowAuthModal(true);
    } else {
      setSelectedArea(searchValue);
      setSearchParams({ area: searchValue });
    }
  };

  const handleAuthSuccess = () => {
    if (pendingSearch) {
      setSelectedArea(pendingSearch);
      setSearchParams({ area: pendingSearch });
      setPendingSearch(null);
    }
  };

  const filteredAgents = selectedArea
    ? agents.filter(agent => 
        agent.covered_areas.some(area => 
          area.toLowerCase().includes(selectedArea.toLowerCase())
        )
      )
    : [];

  const clearSearch = () => {
    setSelectedArea(null);
    setSearchValue('');
    setSearchParams({});
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={
          selectedArea
            ? `Rental Agents in ${selectedArea}, Accra — RentAgentGhana`
            : 'Search Rental Agents in Accra — RentAgentGhana'
        }
        description={
          selectedArea
            ? `Find trusted rental agents working in ${selectedArea}, Accra. Connect directly and skip the listing chase.`
            : 'Search by neighborhood to find responsive rental agents across Accra — East Legon, Cantonments, Osu and more.'
        }
        path={selectedArea ? `/search?area=${encodeURIComponent(selectedArea)}` : '/search'}
      />
      <Navbar />

      <div className="container py-8">
        {/* Search Header */}
        <div className="max-w-2xl mx-auto mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground text-center mb-2">
            Find Rental Agents
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            Search by area to find agents who serve your preferred neighborhood
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <AreaSearch
              ref={areaSearchRef}
              value={searchValue}
              onChange={setSearchValue}
              onSearch={handleSearch}
              placeholder="Enter area, e.g. East Legon"
              className="flex-1"
            />
            <Button onClick={handleSearch} size="lg" className="h-14 px-6 gap-2 transition-all duration-300 hover:scale-105">
              <Search className="h-5 w-5" />
              Search
            </Button>
          </div>

          {/* Quick area chips */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {allAreas.slice(0, 6).map((area) => (
              <button
                key={area}
                onClick={() => {
                  setSearchValue(area);
                  if (isAuthenticated) {
                    setSelectedArea(area);
                    setSearchParams({ area });
                  } else {
                    setPendingSearch(area);
                    setShowAuthModal(true);
                  }
                }}
                className="px-3 py-1.5 text-sm rounded-full border border-border hover:border-primary hover:text-primary transition-all duration-300 hover:scale-105"
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Results Section */}
        {selectedArea && isAuthenticated && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-5 w-5 text-primary" />
                <span>
                  Showing agents in <span className="font-medium text-foreground">{selectedArea}</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                Clear search
              </Button>
            </div>

            {agentsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAgents.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} found</span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents.map((agent) => (
                    <AgentCard 
                      key={agent.id} 
                      agent={agent} 
                      isContacted={contactedAgentIds.includes(agent.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">No agents found</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  We couldn't find any agents serving "{selectedArea}". Try searching for a different area or check back later.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no search yet */}
        {!selectedArea && isAuthenticated && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Search for an area</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Enter a neighborhood in Accra to find rental agents who serve that area.
            </p>
          </div>
        )}

        {/* Prompt to search when not authenticated and no pending search */}
        {!isAuthenticated && !selectedArea && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Find agents in your area</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Search for a neighborhood to discover rental agents who can help you find your next home.
            </p>
          </div>
        )}
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => {
          setShowAuthModal(false);
          setPendingSearch(null);
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
