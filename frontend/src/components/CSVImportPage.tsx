import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Upload, FileText, Download, Loader2, Image as ImageIcon, FileText as LyricsIcon } from "lucide-react";
import { toastWithSound as toast } from "@/lib/toast-with-sound";
import { logger } from "@/lib/logger";
import type { CSVTrack } from "@/types/api";
import { SelectCSVFiles, ParseCSVPlaylist, GetSpotifyMetadata } from "../../wailsjs/go/main/App";

interface CSVImportPageProps {
  tracks: CSVTrack[];
  setTracks: (tracks: CSVTrack[]) => void;
  csvFilePath: string;
  setCSVFilePath: (path: string) => void;
  playlistName: string;
  setPlaylistName: (name: string) => void;
  onDownloadTrack: (
    isrc: string,
    name: string,
    artists: string,
    albumName: string,
    spotifyId?: string,
    playlistName?: string,
    durationMs?: number,
    position?: number,
    albumArtist?: string,
    releaseDate?: string,
    coverUrl?: string
  ) => void;
  onDownloadCover: (coverUrl: string, trackName: string, artistName: string, albumName?: string) => void;
  onDownloadLyrics: (spotifyId: string, trackName: string, artistName: string, albumName?: string) => void;
}

export function CSVImportPage({ 
  tracks, 
  setTracks, 
  csvFilePath, 
  setCSVFilePath,
  playlistName,
  setPlaylistName,
  onDownloadTrack,
  onDownloadCover,
  onDownloadLyrics
}: CSVImportPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadCovers, setDownloadCovers] = useState(true);
  const [downloadLyrics, setDownloadLyrics] = useState(true);

  const parseCSV = useCallback(async (filePath: string) => {
    setIsLoading(true);
    try {
      const tracks: CSVTrack[] = await ParseCSVPlaylist(filePath);
      if (tracks && tracks.length > 0) {
        setTracks(tracks);
        toast.success(`Loaded ${tracks.length} tracks from CSV`);
      } else {
        toast.error("No tracks found in CSV file");
      }
    } catch (err) {
      toast.error("Failed to parse CSV file");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectCSV = useCallback(async () => {
    try {
      const filePaths = await SelectCSVFiles();
      if (filePaths && filePaths.length > 0) {
        const filePath = filePaths[0];
        setCSVFilePath(filePath);
        
        const fileName = filePath.split(/[/\\]/).pop() || "";
        const nameWithoutExt = fileName.replace(/\.csv$/i, "");
        setPlaylistName(nameWithoutExt);
        
        await parseCSV(filePath);
      }
    } catch (err) {
      toast.error("Failed to select CSV file");
      console.error(err);
    }
  }, [parseCSV]);

  const handleDownloadTrack = useCallback(async (track: CSVTrack, index: number) => {
    try {
      if (!track.spotify_id) {
        toast.error(`Track "${track.track_name}" has no Spotify ID`);
        return;
      }

      logger.info(`[CSV] Downloading track: ${track.track_name} by ${track.artist_name}`);

      // Fetch metadata for additional info
      let coverUrl = "";
      try {
        const metadataJson = await GetSpotifyMetadata({
          url: `https://open.spotify.com/track/${track.spotify_id}`,
          batch: false,
          delay: 0,
          timeout: 30,
        });
        const metadata = JSON.parse(metadataJson);
        if (metadata.track?.images) {
          const images = metadata.track.images;
          coverUrl = Array.isArray(images) && images.length > 0 ? (images[0].url || images[0]) : images;
        }
      } catch (err) {
        logger.warning(`[CSV] Failed to fetch metadata for ${track.track_name}: ${err}`);
      }

      // Download track with playlist folder
      onDownloadTrack(
        track.spotify_id,
        track.track_name,
        track.artist_name,
        track.album_name || "",
        track.spotify_id,
        playlistName, // Use playlist name as subfolder
        track.duration_ms,
        index + 1,
        track.artist_name,
        track.release_date,
        coverUrl
      );

      // Download cover if enabled
      if (downloadCovers && coverUrl) {
        setTimeout(() => {
          onDownloadCover(coverUrl, track.track_name, track.artist_name, track.album_name);
        }, 100);
      }

      // Download lyrics if enabled
      if (downloadLyrics) {
        setTimeout(() => {
          onDownloadLyrics(track.spotify_id, track.track_name, track.artist_name, track.album_name);
        }, 200);
      }
      
      toast.success(`Added "${track.track_name}" to download queue`);
    } catch (err) {
      logger.error(`[CSV] Failed to download track ${track.track_name}: ${err}`);
      toast.error(`Failed to download "${track.track_name}"`);
    }
  }, [onDownloadTrack, onDownloadCover, onDownloadLyrics, playlistName, downloadCovers, downloadLyrics]);

  const handleDownloadAll = useCallback(async () => {
    if (tracks.length === 0) {
      toast.error("No tracks to download");
      return;
    }

    toast.info(`Adding ${tracks.length} tracks to download queue...`);
    
    for (let i = 0; i < tracks.length; i++) {
      await handleDownloadTrack(tracks[i], i);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast.success(`All ${tracks.length} tracks added to download queue`);
  }, [tracks, handleDownloadTrack]);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">CSV Import</h1>
          <p className="text-muted-foreground">
            Import tracks from Spotify CSV export files
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-4">Select CSV File</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a Spotify CSV export file
              </p>
            </div>

            <Button
              onClick={handleSelectCSV}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Select CSV File
                </>
              )}
            </Button>

            {csvFilePath && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{csvFilePath}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="download-covers" 
                  checked={downloadCovers}
                  onCheckedChange={(checked) => setDownloadCovers(checked as boolean)}
                />
                <Label htmlFor="download-covers" className="flex items-center gap-2 cursor-pointer">
                  <ImageIcon className="h-4 w-4" />
                  Download covers
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="download-lyrics" 
                  checked={downloadLyrics}
                  onCheckedChange={(checked) => setDownloadLyrics(checked as boolean)}
                />
                <Label htmlFor="download-lyrics" className="flex items-center gap-2 cursor-pointer">
                  <LyricsIcon className="h-4 w-4" />
                  Download lyrics
                </Label>
              </div>
            </div>
          </div>
        </Card>

        {tracks.length > 0 && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {playlistName || "Tracks"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tracks.length} track{tracks.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button onClick={handleDownloadAll}>
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {tracks.map((track, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{track.track_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {track.artist_name}
                        {track.album_name && `  ${track.album_name}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownloadTrack(track, index)}
                      disabled={!track.spotify_id}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
