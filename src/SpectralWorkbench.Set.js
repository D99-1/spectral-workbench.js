SpectralWorkbench.Set = SpectralWorkbench.Datum.extend({

  // data as it arrives from server-side JSON
  init: function(data, _graph) {

    this._super(data, _graph);

    this.spectra = []; 

    var set = this;

    set.load = function() {

      $.each(set.json.spectra, function(i,spectrum) {

        set.spectra.push(new SpectralWorkbench.Spectrum(spectrum));
     
      });

    }

    set.d3 = function() {
 
      var data = [];
 
      $.each(set.spectra, function(i,spectrum) {

        data = data.concat([
          {
            values: spectrum.average,
            key:    '#' + spectrum.id + ': ' + spectrum.title,
            id:     spectrum.id
          }
        ]);

      });
 
      return data;
 
    }



    /* ======================================
     * Output server-style JSON of the spectrum
     * with all active powertags/operations applied -- exactly as currently seen in the graph
     * STUBBED FOR NOW; could aggreate 
     */
    set.toJSON = function() {

      var json = [];

      set.spectra.forEach(function(spectrum) {

        json.push({
          id: spectrum.id,
          title: spectrum.json.title,
          notes: spectrum.json.notes,
          author: spectrum.json.author,
          lines: spectrum.toJSON()
        });

      });

      return json;

    }


    /* ======================================
     * Prepares a CSV formatted data in range
     * including all spectra, all channels, wavelength, and pixel
     */
    set.encodeFullCSV = function() {

      var lines = [];
      var header = "SpectrumID,SpectrumTitle,Wavelength,Pixel,Average,Red,Green,Blue";
      lines.push(header);

      set.spectra.forEach(function(spectrum) {
        spectrum.average.forEach(function(line, i) {
          var wavelength = spectrum.isCalibrated() ? spectrum.average[i].x : "";
          var pixel = spectrum.isCalibrated() ? i : spectrum.average[i].x; // if not calibrated, x is pixel

          var row = [
            spectrum.id,
            spectrum.title,
            wavelength,
            pixel,
            +(spectrum.average[i].y * 255).toPrecision(spectrum.sigFigIntensity),
            +(spectrum.red[i].y * 255).toPrecision(spectrum.sigFigIntensity),
            +(spectrum.green[i].y * 255).toPrecision(spectrum.sigFigIntensity),
            +(spectrum.blue[i].y * 255).toPrecision(spectrum.sigFigIntensity)
          ];
          lines.push(row.join(','));
        });
      });

      return lines.join('\n');

    }


    /* ======================================
     * Returns [min, max] x-axis extent across all
     * member spectra in wavelength nanometers,
     * without applying wavelength range limits.
     * This only returns calibrated spectra (for now).
     */
    set.getFullExtentX = function() {

      return d3.extent(set.spectra.map(function(spectrum){ return spectrum.getFullExtentX(); }));

    }


    /* ======================================
     * Returns [min, max] x-axis extent across all member spectra
     * after applying wavelength range limits
     */
    set.getExtentX = function() {

      return d3.extent(set.spectra.map(function(spectrum){ return spectrum.getExtentX(); }));

    }


    /* ======================================
     * Returns [min, max] y-axis extent across all member spectra
     */
    set.getExtentY = function() {

      return d3.extent(set.spectra.map(function(spectrum){ return spectrum.getExtentY(); }));

    }


    /* ======================================
     * Returns array of overexposure assessments 
     * (boolean) of member spectra
     */
    set.getOverexposure = function() {

      var overexposure = [];
      set.spectra.map(function(spectrum) {

        overexposure.push(spectrum.getOverexposure());

      });

      return overexposure;
    }


    this.load();

  }

});
