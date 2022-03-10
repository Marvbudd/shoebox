<?xml version="1.0"?>

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns="http://www.w3.org/TR/REC-html40" version="2.0">
  <xsl:param name="category" select="brkErma" />

  <!-- List inverted by person -->
  <xsl:template match="/">
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="accessions">
    <table id="maintable">
      <thead>
        <tr class="firstRow">
          <td>Person</td>
          <td class="date">Date</td>
        </tr>
      </thead>
      <tbody>
        <xsl:apply-templates select="*/person/last" mode="main">
          <xsl:sort select="." />
          <xsl:sort select="../first" />
          <xsl:sort select="../../date/year" />
          <xsl:sort select="../../date/month" />
          <xsl:sort select="../../date/day" />
        </xsl:apply-templates>
      </tbody>
    </table>
  </xsl:template>

  <xsl:template match="last" mode="main">
    <tr>
			<xsl:attribute name='class'>
				<xsl:value-of select="../../type" />
			</xsl:attribute>
			<xsl:attribute name="accession">
				<xsl:value-of select="../../accession"/>
			</xsl:attribute>
      <xsl:attribute name="categories">
        <xsl:value-of select="../../@categories" />
      </xsl:attribute>
      <td><xsl:if test="contains(../@categories, $category)">
          <div>
            <xsl:value-of select="../first" />
            <xsl:text> </xsl:text>
            <xsl:value-of select="." />
          </div>
        </xsl:if>
      </td>
      <td><div class="dateData"><xsl:apply-templates select="../../date" /></div></td>
    </tr>
  </xsl:template>

  <xsl:template match="date">
    <xsl:value-of select="day" />
    <xsl:text> </xsl:text>
    <xsl:value-of select="month" />
    <xsl:text> </xsl:text>
    <xsl:value-of select="year" />
  </xsl:template>
</xsl:stylesheet>
