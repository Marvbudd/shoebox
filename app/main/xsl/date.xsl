<?xml version="1.0"?>

<xsl:stylesheet
   xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
   xmlns:xs="http://www.w3.org/2001/XMLSchema"
   exclude-result-prefixes="xs"
   version="2.0">

  <!-- Root template -->
  <xsl:template match="/">
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="accessions">
    <table class="maintable">
      <thead>
        <tr class="firstRow">
          <td class="date">Date</td>
          <td>Description</td>
        </tr>
      </thead>
      <tbody>
        <xsl:apply-templates>
          <xsl:sort select="date/year" />
          <!-- https://stackoverflow.com/questions/19799312/translating-month-names-into-number-using-only-xsl-version-1-0 -->
          <!-- <xsl:sort select="string-length(substring-before('JanFebMarAprMayJunJulAugSepOctNovDec', month)) div 3 + 1" /> -->
          <xsl:sort select="date/month" />
          <xsl:sort select="date/day" />
          <xsl:sort select="person/last" />
          <xsl:sort select="person/first" />
        </xsl:apply-templates>
      </tbody>
    </table>
  </xsl:template>

  <xsl:template match='item'>
    <tr>
      <xsl:attribute name='class'>
        <xsl:value-of select="./type" />
      </xsl:attribute>
      <xsl:attribute name="accession">
        <xsl:value-of select="accession"/>
      </xsl:attribute>
      <xsl:attribute name="categories">
        <xsl:value-of select="./@categories" />
      </xsl:attribute>
      <td><div class="dateData">
        <xsl:apply-templates select="./date" /></div></td>
      <td>
        <div class="descData">
          <xsl:apply-templates select="./person" mode="detail" />
        </div>
      </td>
    </tr>
  </xsl:template>

  <xsl:template match="date">
    <xsl:value-of select="day" />
    <xsl:text> </xsl:text>
    <xsl:value-of select="month" />
    <xsl:text> </xsl:text>
    <xsl:value-of select="year" />
  </xsl:template>

  <xsl:template match="person" mode="detail">
    <xsl:value-of select="first" />
    <xsl:text> </xsl:text>
    <xsl:value-of select="last" />
    <xsl:if test="position()!=last()">, </xsl:if>
  </xsl:template>
</xsl:stylesheet>
