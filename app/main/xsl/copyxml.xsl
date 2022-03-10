<xsl:stylesheet
   xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
   version="1.0">

  <xsl:output method="xml" version="1.0" encoding="UTF-8" />
  <xsl:param name="category">${category}</xsl:param>

  <xsl:template match="/">
    <xsl:element name="accessions">
      <xsl:attribute name="xmlns:xsi">http://www.w3.org/2001/XMLSchema-instance</xsl:attribute>
      <xsl:attribute name="xsi:noNamespaceSchemaLocation">accessions.xsd</xsl:attribute>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="accessions">
    <xsl:apply-templates select="item[contains(@categories, $category)]">
      <xsl:sort select="type" />
      <xsl:sort select="link" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match='item'>
    <xsl:choose>
      <xsl:when test="type='photo'">
        <xsl:call-template name="copyItem" />
      </xsl:when>
      <xsl:when test="type='tape'">
        <xsl:call-template name="copyItem" />
      </xsl:when>
      <xsl:when test="type='video'">
        <xsl:call-template name="copyItem" />
      </xsl:when>
      <xsl:otherwise />
    </xsl:choose>
  </xsl:template>

  <xsl:template name="copyItem">
    <item>
      <xsl:for-each select="*">
        <xsl:copy-of select="." />
      </xsl:for-each>
    </item>
  </xsl:template>
</xsl:stylesheet>