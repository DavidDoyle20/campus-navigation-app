#!/Users/daviddoyle/workspace/github.com/DavidDoyle20/campus-navigation-app/myenv/bin/python3.12

import sys

from osgeo.gdal import deprecation_warn

# import osgeo_utils.gdalmove as a convenience to use as a script
from osgeo_utils.gdalmove import *  # noqa
from osgeo_utils.gdalmove import main

deprecation_warn("gdalmove")
sys.exit(main(sys.argv))
